import React from 'react';
import ForgeReconciler, { Textfield } from '@forge/react';
import LookupTable from './LookupTable';

ForgeReconciler.render(<LookupTable />);

/**
 * Config form for the LookupTable macro.
 *
 * In MacroConfig context the host renders its own Save/Cancel buttons and
 * collects field values by their `name` attribute when the user saves.
 * No state, no view.submit() — just declare the fields.
 */
const LookupTableConfig = () => (
  <Textfield
    name="id"
    label="Table ID"
    placeholder="e.g. my-table"
  />
);

ForgeReconciler.addConfig(<LookupTableConfig />);
