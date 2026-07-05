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
 * Config pane for the LookupKey macro.
 *
 * Uses Form from @forge/react so Forge manages field values internally.
 * view.submit() saves the config object and closes the config pane.
 */
const LookupKeyConfig = () => {
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setError(null);
    try {
      await view.submit({
        pageId: formData.pageId,
        lookupId: formData.lookupId,
        key: formData.key,
      });
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
          <Label labelFor="pageId">Page ID</Label>
          <Textfield name="pageId" id="pageId" placeholder="e.g. 123456" />
          <HelperMessage>
            The numeric ID of the page containing the LookupTable macro.
            Find it in the page URL: /wiki/spaces/SPACE/pages/123456/Page-Title
          </HelperMessage>
        </FormSection>
        <FormSection>
          <Label labelFor="lookupId">Lookup Table ID</Label>
          <Textfield name="lookupId" id="lookupId" placeholder="e.g. my-table" />
          <HelperMessage>
            The ID configured on the LookupTable macro on the target page.
          </HelperMessage>
        </FormSection>
        <FormSection>
          <Label labelFor="key">Key</Label>
          <Textfield name="key" id="key" placeholder="e.g. owner" />
          <HelperMessage>
            The key whose value you want to display inline.
          </HelperMessage>
        </FormSection>
        <FormFooter>
          <Button type="submit" appearance="primary">Save</Button>
        </FormFooter>
      </Form>
    </Stack>
  );
};

ForgeReconciler.render(<LookupKeyConfig />);
