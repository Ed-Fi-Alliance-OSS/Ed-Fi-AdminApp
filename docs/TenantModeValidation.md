# Tenant Mode Validation

At the moment of environment creation we need a way to find out if the Admin Api is running on Single tenant mode or multitenant mode.

Currently we send a request to Ods Api Discovery Url and based on the presence of the text `tenantIdentifier` we collect that information.
If the text is part of the response anywhere we assume the environment is multitenant, single tenant otherwise.

The initial approach consists of adding a new field to the info endpoint to indicate if Multi-tenant mode is enabled.

The response looks currently like this:

```json
{
  "version": "2.0",
  "build": "2.2.3.0"
}
```

With the new field it would look like this:

```json
{
  "version": "2.0",
  "build": "2.2.3.0",
  "isMultitenantEnabled": "true"
}
```

## Bennefits of the new field

1. Easy integration with what we currentlly have on Admin App.
2. Easy implementation on Admin Api.
3. No authentication required.
