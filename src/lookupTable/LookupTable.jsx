/**
 * LookupTable.jsx
 *
 * View mode component for the LookupTable macro.
 *
 * Renders an editable key-value table backed by a Confluence content property.
 * Data is loaded and saved via backend resolver functions (invoke) rather than
 * requestConfluence directly, because the Confluence Content Properties API
 * requires OAuth scopes that are only available in the backend context.
 *
 * Config (table ID) is managed separately by the addConfig() call in index.jsx.
 */

import React, { useState, useEffect } from 'react';
import {
  useConfig,
  useProductContext,
  Button,
  DynamicTable,
  Text,
  Textfield,
  Stack,
  Inline,
  SectionMessage,
  Spinner,
  Strong,
} from '@forge/react';

import { invoke } from '@forge/bridge';

/**
 * Editable key-value table. Receives the resolved tableId and pageId as props
 * so this component only handles data fetching and rendering.
 */
const TableView = ({ tableId, pageId }) => {
  const [kvPairs, setKvPairs] = useState({});
  // propertyId: v2 numeric ID used in the PUT URL. null = property not yet created.
  const [propertyId, setPropertyId] = useState(null);
  // propertyVersion: current version number. PUT body must send version+1.
  const [propertyVersion, setPropertyVersion] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // editingKey: the original key of the row currently in edit mode, or null.
  const [editingKey, setEditingKey] = useState(null);
  // editKey / editValue: controlled inputs for the row being edited.
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadData();
  }, [pageId, tableId]);

  /**
   * Calls the getTableData resolver to fetch the current KV pairs.
   * A null response means no property exists yet — treat as an empty table.
   */
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke('getTableData', { pageId, tableId });
      if (data === null) {
        setKvPairs({});
        setPropertyId(null);
        setPropertyVersion(null);
      } else {
        setKvPairs(data.value || {});
        setPropertyId(data.id ?? null);
        setPropertyVersion(data.version?.number ?? null);
      }
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calls the saveTableData resolver to persist the given KV pairs.
   * Passes the current version so the resolver can decide POST vs PUT.
   */
  const saveData = async (pairs) => {
    setSaving(true);
    setError(null);
    try {
      const data = await invoke('saveTableData', { pageId, tableId, pairs, propertyId, propertyVersion });
      setKvPairs(pairs);
      setPropertyId(data.id ?? null);
      setPropertyVersion(data.version?.number ?? null);
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (keyToDelete) => {
    const updated = { ...kvPairs };
    delete updated[keyToDelete];
    await saveData(updated);
  };

  const handleAdd = async () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();
    if (!trimmedKey) {
      setError('Key cannot be empty.');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(kvPairs, trimmedKey)) {
      setError(`Key "${trimmedKey}" already exists.`);
      return;
    }
    await saveData({ ...kvPairs, [trimmedKey]: trimmedValue });
    setNewKey('');
    setNewValue('');
  };

  /** Puts a row into edit mode, pre-filling inputs with the current key/value. */
  const handleStartEdit = (key, value) => {
    setEditingKey(key);
    setEditKey(key);
    setEditValue(value);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditKey('');
    setEditValue('');
  };

  /**
   * Saves the edited row. Handles key renames: removes the old key and writes
   * the new one. Rejects empty keys and conflicts with existing keys.
   */
  const handleSaveEdit = async () => {
    const trimmedKey = editKey.trim();
    const trimmedValue = editValue.trim();
    if (!trimmedKey) {
      setError('Key cannot be empty.');
      return;
    }
    // Only reject a key conflict when the key actually changed.
    if (trimmedKey !== editingKey && Object.prototype.hasOwnProperty.call(kvPairs, trimmedKey)) {
      setError(`Key "${trimmedKey}" already exists.`);
      return;
    }
    const updated = { ...kvPairs };
    if (trimmedKey !== editingKey) {
      // Key was renamed — remove the old entry first.
      delete updated[editingKey];
    }
    updated[trimmedKey] = trimmedValue;
    await saveData(updated);
    setEditingKey(null);
    setEditKey('');
    setEditValue('');
  };

  if (loading) return <Spinner size="medium" />;

  // Whether any row is in edit mode — used to disable other row actions
  // so the user can't trigger overlapping saves.
  const isEditing = editingKey !== null;

  const rows = Object.entries(kvPairs).map(([k, v]) => {
    if (k === editingKey) {
      // This row is in edit mode: replace text with inputs and action buttons.
      return {
        key: k,
        cells: [
          {
            key: 'key',
            content: (
              <Textfield
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
              />
            ),
          },
          {
            key: 'value',
            content: (
              <Textfield
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            ),
          },
          {
            key: 'actions',
            content: (
              <Inline space="space.100" alignBlock="center">
                <Button
                  appearance="primary"
                  isLoading={saving}
                  isDisabled={saving}
                  onClick={handleSaveEdit}
                >
                  Save
                </Button>
                <Button
                  appearance="subtle"
                  isDisabled={saving}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </Inline>
            ),
          },
        ],
      };
    }

    // Normal row: show text and Edit / Delete buttons.
    return {
      key: k,
      cells: [
        { key: 'key', content: <Text>{k}</Text> },
        { key: 'value', content: <Text>{v}</Text> },
        {
          key: 'actions',
          content: (
            <Inline space="space.100" alignBlock="center">
              <Button
                appearance="subtle"
                isDisabled={saving || isEditing}
                onClick={() => handleStartEdit(k, v)}
              >
                Edit
              </Button>
              <Button
                appearance="subtle"
                isDisabled={saving || isEditing}
                onClick={() => handleDelete(k)}
              >
                Delete
              </Button>
            </Inline>
          ),
        },
      ],
    };
  });

  return (
    <Stack space="space.200">
      {error && (
        <SectionMessage appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      <DynamicTable
        head={{
          cells: [
            { key: 'key', content: <Strong>Key</Strong> },
            { key: 'value', content: <Strong>Value</Strong> },
            { key: 'actions', content: <Strong>Actions</Strong> },
          ],
        }}
        rows={rows}
        emptyView={<Text>No entries yet. Use the fields below to add one.</Text>}
      />
      <Inline space="space.100" alignBlock="center">
        <Textfield
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <Textfield
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <Button
          appearance="primary"
          isLoading={saving}
          isDisabled={saving || isEditing}
          onClick={handleAdd}
        >
          Add
        </Button>
      </Inline>
    </Stack>
  );
};

/**
 * Root component. Waits for context and config to load, then renders
 * the table view. Works in both edit and view mode.
 */
const LookupTable = () => {
  const context = useProductContext();
  const config = useConfig();

  if (context === undefined) {
    return <Spinner size="medium" />;
  }

  const tableId = config?.id;
  const pageId = context?.extension?.content?.id;

  if (!tableId) {
    return (
      <SectionMessage appearance="warning">
        <Text>This macro has not been configured yet. Click the macro and select Configure.</Text>
      </SectionMessage>
    );
  }

  return <TableView tableId={tableId} pageId={pageId} />;
};

export default LookupTable;
