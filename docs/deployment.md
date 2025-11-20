# Deployment Notes

## Node.js Deprecation Warnings

### Issue Description

When running the API server, you may encounter Node.js deprecation warnings similar to:

```
(node:26084) [DEP0044] DeprecationWarning: The `util.isArray` API is deprecated. Please use `Array.isArray()` instead.
(node:26084) [DEP0055] DeprecationWarning: The `util.isRegExp` API is deprecated. Please use `arg instanceof RegExp` instead.
(node:26084) [DEP0047] DeprecationWarning: The `util.isDate` API is deprecated. Please use `arg instanceof Date` instead.
```

### Root Cause

These warnings originate from third-party dependencies in the Node.js ecosystem that have not yet migrated to modern JavaScript APIs. The warnings are caused by:

- **DEP0044**: Dependencies using `util.isArray()` instead of `Array.isArray()`
- **DEP0055**: Dependencies using `util.isRegExp()` instead of `arg instanceof RegExp`
- **DEP0047**: Dependencies using `util.isDate()` instead of `arg instanceof Date`

### Impact

These deprecation warnings are **cosmetic only** and do not affect application functionality. They are informational messages from Node.js indicating that certain APIs will be removed in future Node.js versions.

### Resolution Options

Since these warnings come from third-party dependencies, they cannot be directly fixed in the application code. You have several options for managing them:

#### Option 1: Suppress All Deprecation Warnings (Recommended for Production)

Add the `--no-deprecation` flag to your Node.js startup command:

```bash
NODE_OPTIONS="--no-deprecation" npm run start:api:dev
```

Or modify your package.json scripts:

```json
{
  "scripts": {
    "start:api": "NODE_OPTIONS=\"--no-deprecation\" nx run api:serve --configuration=production"
  }
}
```

#### Option 2: Suppress Specific Warnings

Target only the specific deprecation warnings:

```bash
NODE_OPTIONS="--disable-warning=DEP0044 --disable-warning=DEP0055 --disable-warning=DEP0047" npm run start:api:dev
```

#### Option 3: Keep Warnings (Development Only)

For development environments, you may choose to keep the warnings visible to stay informed about dependency health, while understanding they don't affect functionality.

### Recommendations

- **Production Deployments**: Use `--no-deprecation` to ensure clean logs
- **Development Environments**: Consider keeping warnings visible for awareness
- **CI/CD Pipelines**: Suppress warnings to avoid noise in build logs
- **Monitoring**: These warnings should not trigger alerts as they don't indicate application errors

### Future Considerations

- Monitor dependency updates for fixes to these warnings
- Consider updating to newer versions of dependencies when available
- These warnings may become errors in future major Node.js versions, but this would affect the entire Node.js ecosystem

### Example Production Startup

```bash
# Docker container or production server
NODE_OPTIONS="--no-deprecation" node dist/main.js

# Or with environment variables
export NODE_OPTIONS="--no-deprecation"
npm run start:api
```

## Yopass Integration Configuration

### Overview

The Admin App v4 includes optional Yopass integration for securely transmitting ODS API keys and secrets. By default, Yopass is enabled, but you can configure the system to display credentials directly in the UI instead.

### Configuration Options

#### Option 1: Enable Yopass (Default)

When Yopass is enabled, API keys and secrets are transmitted through secure one-time links:

```bash
# Environment variable
USE_YOPASS=true
YOPASS_URL=https://your-yopass-instance.com
```

**Benefits:**

- Enhanced security through encrypted one-time links
- Credentials are never displayed directly in the UI
- Automatic expiration of shared secrets

**Requirements:**

- A running Yopass instance
- Network connectivity to the Yopass service

#### Option 2: Disable Yopass (Direct Display)

When Yopass is disabled, keys and secrets are displayed directly in the UI:

```bash
# Environment variable
USE_YOPASS=false
# YOPASS_URL is not required when disabled
```

**Benefits:**

- Eliminates dependency on external Yopass service
- Simpler deployment architecture
- Immediate credential access without additional clicks

**Security Considerations:**

- Credentials are temporarily visible in the browser
- Ensure proper HTTPS encryption
- Consider network security and screen recording policies

### Implementation Details

The system uses TypeScript union types to handle both response formats:

- **V1 API**: `ApplicationResponseV1` union type
- **V2 API**: `ApplicationResponseV2` union type

Each response includes a `secretSharingMethod` property with values:

- `SecretSharingMethod.Yopass` - One-time link response
- `SecretSharingMethod.Direct` - Key/secret response

### UI Behavior

#### With Yopass Enabled

- Users receive a secure link to view credentials
- Link expires after first use or timeout
- Standard Yopass interface for credential retrieval

#### With Yopass Disabled

- Credentials display directly after application creation/reset
- Warning message about credential sensitivity
- Limited display time for security

### Migration Guide

To switch from Yopass to direct display:

1. **Update environment configuration:**

   ```bash
   USE_YOPASS=false
   ```

2. **Remove Yopass URL** (optional):

   ```bash
   # YOPASS_URL=https://your-yopass-instance.com
   ```

3. **Restart the application services**

4. **Verify functionality** by creating a new application or resetting credentials

### Troubleshooting

#### Yopass integration failing

- Verify `YOPASS_URL` is accessible
- Check network connectivity
- Consider switching to direct display mode

#### Credentials not displaying with direct mode

- Confirm `USE_YOPASS=false` is set
- Check browser console for JavaScript errors
- Verify API responses include `secretSharingMethod: 'Direct'`

### Security Recommendations

- **Production environments**: Use HTTPS for all communications
- **Direct display mode**: Implement screen recording policies
- **Network security**: Ensure secure transmission channels
- **Access logging**: Monitor credential access patterns
- **Regular rotation**: Implement credential rotation policies
