/**
 * LookupKey.jsx
 *
 * View mode component for the LookupKey macro.
 *
 * Reads a single value from a Confluence page property and displays
 * it inline on the page. Config is handled separately via addConfig()
 * in index.jsx — this component only runs in view mode.
 */

import React, { useState, useEffect } from 'react';
import {
  useConfig,
  useProductContext,
  Text,
  SectionMessage,
  Spinner,
} from '@forge/react';

import { invoke } from '@forge/bridge';

/**
 * Root component. Waits for context and config to load, then fetches
 * the requested value from the target page's content property.
 */
const LookupKey = () => {
  const context = useProductContext();
  const config = useConfig();

  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Select saves option objects {label,value}; Textfield saves plain strings.
  // Normalise so the resolver always receives a plain string.
  const rawConfig = config || {};
  const pageId = typeof rawConfig.pageId === 'object' ? rawConfig.pageId?.value : rawConfig.pageId;
  const lookupId = typeof rawConfig.lookupId === 'object' ? rawConfig.lookupId?.value : rawConfig.lookupId;
  const { key } = rawConfig;

  useEffect(() => {
    // Wait for context to load and ensure all config params are present.
    if (!context || context?.isConfig) return;
    if (!pageId || !lookupId || !key) return;
    fetchValue();
  }, [context, pageId, lookupId, key]);

  /**
   * Fetches the page property from the target page and extracts the
   * value for the configured key.
   */
  const fetchValue = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getLookupValue', { pageId, lookupId, key });
      if (result === null) {
        setError(`Key "${key}" or lookup table was not found.`);
      } else {
        setValue(result);
      }
    } catch (err) {
      setError(`Failed to load lookup table: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (context === undefined) {
    return <Spinner size="small" />;
  }

  // View mode — not yet configured.
  if (!pageId || !lookupId || !key) {
    return (
      <SectionMessage appearance="warning">
        <Text>This macro has not been configured yet. Click the macro and select Configure.</Text>
      </SectionMessage>
    );
  }

  if (loading) return <Spinner size="small" />;

  if (error) {
    return (
      <SectionMessage appearance="warning">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }

  return <Text>{value}</Text>;
};

export default LookupKey;
