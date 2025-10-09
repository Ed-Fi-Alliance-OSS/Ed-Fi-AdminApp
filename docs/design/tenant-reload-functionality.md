# Design: Tenant Reload

## Feature

Context: Ed-Fi Admin App running outside of a Starting Blocks Environment.

User Story: _As a system administrator, I want to update the tenant information in an environment without having to delete and recreate it, for example, when I add a new tenant to an existing Ed-Fi API deployment_.

Feature Name: tenant reload.

## Overview

The Tenant Reload functionality is a system that allows administrators to reload tenant configurations in the Ed-Fi Admin API server without requiring a full system restart. This document explains what the tenant reload does and how it works.

## What Tenant Reload Does

Tenant Reload is a **maintenance operation** that instructs the Admin API server to refresh its internal tenant configurations. This is particularly useful when:

1. Tenant configurations have been modified but not yet reflected in the running system
2. There are synchronization issues between the database and application memory
3. Administrators need to force a refresh of tenant data without restarting services

### Purpose

The primary purposes of the tenant reload functionality are:

1. **Configuration Refresh**: Update tenant settings in the Admin API server
2. **Cache Invalidation**: Clear any cached tenant data in memory
3. **Credentials Reset**: Ensure API credentials are correctly loaded
4. **Zero-Downtime Updates**: Apply configuration changes without service interruption

### Behavior

```json
Admin App (UI) → Lambda Function → Admin API Server
```

- **One-way operation**: Admin App initiates a reload command
- **No data transfer**: Unlike sync, no data is transferred between systems
- **Server-side execution**: The actual reload happens in the Admin API server

## Architecture Overview

### Core Components

1. **Frontend Actions** (`packages/fe/src/app/Pages/SbEnvironmentGlobal/useSbEnvironmentGlobalActions.tsx`)
   - Provides the UI action for reloading tenants
   - Uses React Query for state management
   - Handles success/error notifications

2. **API Client** (`packages/fe/src/app/api/queries/queries.ts`)
   - Defines the API endpoint for the reload operation
   - Maps frontend actions to HTTP requests
   - Handles response formatting

3. **Backend Controller** (`packages/api/src/sb-environments-global/sb-environments-global.controller.ts`)
   - Exposes the reload endpoint
   - Handles authorization and validation
   - Delegates to tenant management service

4. **Tenant Management Service** (`packages/api/src/teams/edfi-tenants/starting-blocks/v2/tenant-mgmt.v2.service.ts`)
   - Invokes AWS Lambda functions
   - Handles error handling and response formatting
   - Version-specific implementation (v2 only)

### Lambda Function Integration

The tenant reload process relies on AWS Lambda functions to communicate with the Admin API server:

#### tenantManagementFunctionArn

This Lambda function serves as the interface to the Admin API server:

**Functionality:**

- Connects to the Admin API server
- Sends reload command to refresh tenant configurations
- Handles authentication and error scenarios
- Returns operation status and results

**AWS Resources Accessed:**

- Admin API server endpoints
- CloudWatch logs for monitoring
- Parameter Store for configuration settings
- IAM roles for authentication

## Version Differences

### V1 (Not Supported)

- **No support**: Tenant reload functionality is not available in v1 environments
- **Alternative**: Users must restart services manually if needed

### V2 (Full Support)

- **Full functionality**: Complete support for tenant reload
- **Lambda integration**: Uses the tenantManagementFunctionArn Lambda function
- **UI integration**: Available in the SB environment actions menu

## Related Files

- `packages/fe/src/app/Pages/SbEnvironmentGlobal/useSbEnvironmentGlobalActions.tsx` - Frontend action hook
- `packages/fe/src/app/api/queries/queries.ts` - API endpoint definition
- `packages/api/src/sb-environments-global/sb-environments-global.controller.ts` - Backend controller
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/tenant-mgmt.v2.service.ts` - Service implementation
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/base-mgmt-service.ts` - Base Lambda function caller
