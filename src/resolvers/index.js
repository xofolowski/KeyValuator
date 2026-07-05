/**
 * resolvers/index.js
 *
 * Backend resolver functions for KeyValuator.
 *
 * Uses api.asApp() + Confluence REST API v2 (/wiki/api/v2/pages/{id}/properties).
 *
 * The v2 API changed how properties are addressed compared to v1:
 *  - Single-property endpoints use a numeric property ID, not the key string.
 *  - The list endpoint returns { results: [{ id, key, version }] } — no value field.
 *
 * Because of this, reads require two calls:
 *  1. List properties to find the numeric ID for our key.
 *  2. Fetch the full property by ID to get the value.
 *
 * Writes (POST/PUT) only need one call, using the property ID stored by the frontend.
 */

import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Looks up a Confluence page property by key using the v2 API.
 *
 * The v2 list endpoint (/properties) returns id+key+version but NOT value.
 * Once we have the property ID we fetch the full object via /properties/{id}.
 *
 * Returns the full property object { id, key, value, version } or null.
 */
async function findPropertyByKey(pageId, propertyKey) {
  // Forge's route() rejects values containing path separators (/ \ ..).
  // A valid Confluence page ID is always a numeric string.
  // Fail early with a clear message rather than a cryptic "path manipulation" error.
  if (!pageId || !/^\d+$/.test(String(pageId))) {
    throw new Error(
      `Invalid page ID "${pageId}". Open the macro config and select a page using the picker.`
    );
  }

  // Step 1: list all properties for the page and find our key.
  const listResp = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}/properties`,
    { headers: { Accept: 'application/json' } }
  );

  const listBody = await listResp.text().catch(() => '');
  console.log(`findPropertyByKey list: status=${listResp.status} body=${listBody}`);

  if (!listResp.ok) {
    let err = {};
    try { err = JSON.parse(listBody); } catch (_) {}
    throw new Error(err.message || `HTTP ${listResp.status}: ${listBody}`);
  }

  const listData = JSON.parse(listBody);
  const entry = (listData.results || []).find(p => p.key === propertyKey);

  if (!entry) return null;

  // Step 2: fetch the full property by its ID to get the value.
  const singleResp = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}/properties/${entry.id}`,
    { headers: { Accept: 'application/json' } }
  );

  const singleBody = await singleResp.text().catch(() => '');
  console.log(`findPropertyByKey single: status=${singleResp.status} body=${singleBody}`);

  if (singleResp.status === 404) return null;

  if (!singleResp.ok) {
    let err = {};
    try { err = JSON.parse(singleBody); } catch (_) {}
    throw new Error(err.message || `HTTP ${singleResp.status}: ${singleBody}`);
  }

  return JSON.parse(singleBody);
}

/**
 * Fetches the KV pair data for a LookupTable.
 *
 * Returns the full property object { id, key, value, version } if it exists,
 * or null if the property has never been saved.
 */
resolver.define('getTableData', async ({ payload }) => {
  const { pageId, tableId } = payload;
  return findPropertyByKey(pageId, tableId);
});

/**
 * Creates or updates the KV pair data as a Confluence page property.
 *
 * Accepts propertyId from the frontend:
 *  - null  → first save, use POST /properties
 *  - "123" → update, use PUT  /properties/{propertyId}
 *
 * The v2 PUT body does NOT require a version number (unlike v1).
 *
 * Returns the saved property with the value we just wrote so the frontend
 * can update its state without a separate GET.
 */
resolver.define('saveTableData', async ({ payload }) => {
  const { pageId, tableId, pairs, propertyId, propertyVersion } = payload;
  const isCreate = propertyId === null || propertyId === undefined;

  console.log(`saveTableData: pageId=${pageId} tableId=${tableId} propertyId=${propertyId} version=${propertyVersion}`);

  // v2 PUT requires the next version number (current + 1), same convention as v1.
  const requestBody = isCreate
    ? { key: tableId, value: pairs }
    : { key: tableId, value: pairs, version: { number: propertyVersion + 1 } };

  const response = await api.asApp().requestConfluence(
    isCreate
      ? route`/wiki/api/v2/pages/${pageId}/properties`
      : route`/wiki/api/v2/pages/${pageId}/properties/${propertyId}`,
    {
      method: isCreate ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  const body = await response.text().catch(() => '');
  console.log(`saveTableData: status=${response.status} body=${body}`);

  if (!response.ok) {
    let err = {};
    try { err = JSON.parse(body); } catch (_) {}
    throw new Error(err.message || `HTTP ${response.status}: ${body}`);
  }

  // Merge API response (id, key, version) with the value we saved.
  // v2 write endpoints return id+key+version but omit value in the response.
  const saved = JSON.parse(body);
  return { ...saved, value: pairs };
});

/**
 * Looks up a single value from a KV table stored as a page property.
 * Returns the string value or null if the property or key was not found.
 */
resolver.define('getLookupValue', async ({ payload }) => {
  const { pageId, lookupId, key } = payload;

  const property = await findPropertyByKey(pageId, lookupId);
  if (!property) return null;

  const kvPairs = property.value || {};
  if (Object.prototype.hasOwnProperty.call(kvPairs, key)) {
    return String(kvPairs[key]);
  }

  return null;
});

/**
 * Returns the first 50 pages in a space, used to pre-populate the page picker
 * in the LookupKey macro config. The Select's built-in filter lets the user
 * narrow down by title without needing a separate search input.
 */
resolver.define('getSpacePages', async ({ payload }) => {
  const { spaceId } = payload;

  const response = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages?space-id=${spaceId}&limit=50`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.results || []).map(p => ({ id: p.id, title: p.title }));
});

/**
 * Searches Confluence pages by title. Used to populate the page picker in the
 * LookupKey macro config. Returns [{id, title}] for each match.
 */
resolver.define('searchPages', async ({ payload }) => {
  const { query } = payload;

  const response = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages?title=${query}&limit=10`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  const data = await response.json();
  return (data.results || []).map(p => ({ id: p.id, title: p.title }));
});

/**
 * Returns basic info ({id, title}) for a single page by ID.
 * Used to pre-populate the page picker when editing an existing LookupKey config.
 */
resolver.define('getPageInfo', async ({ payload }) => {
  const { pageId } = payload;

  const response = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return { id: data.id, title: data.title };
});

/**
 * Returns all content property keys for a page.
 * Used to populate the Lookup Table ID dropdown after a page is chosen.
 */
resolver.define('getPageTableIds', async ({ payload }) => {
  const { pageId } = payload;

  const response = await api.asApp().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}/properties`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.results || []).map(p => p.key);
});

export const handler = resolver.getDefinitions();
