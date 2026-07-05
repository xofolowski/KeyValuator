import React, { useState, useEffect } from 'react';
import ForgeReconciler, {
  Select,
  Textfield,
  useConfig,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import LookupKey from './LookupKey';

ForgeReconciler.render(<LookupKey />);

/**
 * Config form for the LookupKey macro.
 *
 * In Forge MacroConfig the host owns all named form field values — it injects
 * saved config into fields and manages display state. Attempting to control
 * named fields with React `value`/`onChange` fights the host and breaks.
 *
 * The correct pattern:
 *  - Leave named Selects/Textfields uncontrolled (no value= prop).
 *  - Read the live form state with useConfig(), which updates in real-time as
 *    the user changes fields before saving.
 *  - Drive dependent UI (table ID options) from the live useConfig() value.
 */
const LookupKeyConfig = () => {
  const config = useConfig();
  const context = useProductContext();

  const [pageOptions, setPageOptions] = useState([]);
  const [tableOptions, setTableOptions] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Pre-load pages from the current space so the user can filter by typing.
  useEffect(() => {
    const spaceId = context?.extension?.space?.id;
    if (!spaceId) return;
    setPagesLoading(true);
    invoke('getSpacePages', { spaceId })
      .then(pages => setPageOptions(pages.map(p => ({ label: p.title, value: p.id }))))
      .catch(e => console.error('Failed to load space pages:', e))
      .finally(() => setPagesLoading(false));
  }, [context?.extension?.space?.id]);

  // Extract the live page ID from the form. Select saves option objects
  // {label,value}; older plain-string values are also handled.
  const currentPageId =
    typeof config?.pageId === 'object'
      ? config.pageId?.value
      : config?.pageId;

  // Reload table IDs whenever the selected page changes.
  useEffect(() => {
    if (!currentPageId || !/^\d+$/.test(String(currentPageId))) {
      setTableOptions([]);
      return;
    }
    setTablesLoading(true);
    invoke('getPageTableIds', { pageId: currentPageId })
      .then(tableIds => setTableOptions(tableIds.map(id => ({ label: id, value: id }))))
      .catch(e => console.error('Failed to load table IDs:', e))
      .finally(() => setTablesLoading(false));
  }, [currentPageId]);

  return (
    <>
      <Select
        name="pageId"
        label="Page"
        options={pageOptions}
        placeholder={pagesLoading ? 'Loading pages…' : 'Type to filter or select a page'}
        isDisabled={pagesLoading}
      />
      <Select
        name="lookupId"
        label="Lookup Table ID"
        options={tableOptions}
        placeholder={
          tablesLoading
            ? 'Loading tables…'
            : currentPageId
            ? 'Select a table'
            : 'Select a page first'
        }
        isDisabled={!currentPageId || tablesLoading}
      />
      <Textfield
        name="key"
        label="Key"
        placeholder="e.g. owner"
      />
    </>
  );
};

ForgeReconciler.addConfig(<LookupKeyConfig />);
