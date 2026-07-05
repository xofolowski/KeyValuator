import React, { useState } from 'react';
import ForgeReconciler, {
  Form,
  FormSection,
  FormFooter,
  Textfield,
  Label,
  HelperMessage,
  Button,
  Stack,
  Text,
  SectionMessage,
} from '@forge/react';
import { view } from '@forge/bridge';

/**
 * Config pane for the LookupTable macro.
 *
 * Uses Form from @forge/react so Forge manages field values internally —
 * no useState/onChange needed for the text input. onSubmit receives the
 * collected field values keyed by Textfield name attributes.
 *
 * view.submit() saves the config object and closes the config pane.
 */
const LookupTableConfig = () => {
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setError(null);
    try {
      await view.submit({ id: formData.id });
    } catch (err) {
      setError(err?.message || String(err));
    }
  };

  return (
    <Stack space="space.200">
      {error && (
        <SectionMessage appearance="error">
          <Text>Save failed: {error}</Text>
        </SectionMessage>
      )}
      <Form onSubmit={handleSubmit}>
        <FormSection>
          <Label labelFor="id">Table ID</Label>
          <Textfield name="id" id="id" placeholder="e.g. my-table" />
          <HelperMessage>
            A unique identifier for this lookup table on the page.
            Use a different ID for each LookupTable macro on the same page.
          </HelperMessage>
        </FormSection>
        <FormFooter>
          <Button type="submit" appearance="primary">Save</Button>
        </FormFooter>
      </Form>
    </Stack>
  );
};

ForgeReconciler.render(<LookupTableConfig />);
