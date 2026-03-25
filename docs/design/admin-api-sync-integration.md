# Design: Admin API Sync Integration

## Feature

Context: Ed-Fi Admin App running outside of a Starting Blocks Environment.

User Story: _As a system administrator, I want to synchronize the Admin App database's list of tenants, education organizations, ODS instances, and other information with the actual deployed state, so that the user interface can be more responsive and provide better validation for my requests_.

Feature Name: environment synchronization.

## Overview

This document outlines the design for integrating direct Admin API data
retrieval into the existing SB Sync job scheduler. The enhancement adds
conditional sync processing where environments with `startingBlocks: false` will
use Admin API endpoints instead of Lambda functions, while maintaining full
compatibility with existing database schemas.

## Current Architecture

### Existing Sync Flow

1. **Scheduler Job** → Discovers environments with metadata configuration
2. **Environment Sync** → Currently uses Lambda functions exclusively
3. **Version Detection** → Determines SB v1 vs v2
4. **Data Processing** → Stores data in existing table structures

### Current Conditional Logic

```typescript
// Current logic checks for Lambda ARN presence
let sbEnvironment = await this.sbEnvironmentsRepository
  .where(`"configPublic"->>'sbEnvironmentMetaArn' is not null and id = :id`)
  .getOne();

if (sbEnvironment === null) {
  // Fallback for non-Starting Blocks (currently incomplete)
  sbEnvironment = await this.sbEnvironmentsRepository
    .where(`"configPublic"->>'type' is not null and id = :id`)
    .getOne();
}

```

## Proposed Design Changes

### 1. Enhanced Conditional Sync Logic

#### Modified Consumer Flow

```typescript
// Enhanced conditional sync logic with proper routing
async refreshSbEnvironment(environmentId: number) {
  const environment = await this.sbEnvironmentsRepository.findOne({
    where: { id: environmentId }
  });
  
  if (!environment) {
    throw new NotFoundException(`Environment not found with id ${environmentId}`);
  }

  // Key enhancement: Check startingBlocks flag first
  const isStartingBlocks = environment.configPublic?.startingBlocks === true;
  
  if (isStartingBlocks && environment.configPublic?.sbEnvironmentMetaArn) {
    // Use existing Lambda-based sync for Starting Blocks environments    
  } else {
    // Use new Admin API-based sync for non-Starting Blocks environments   
  }
}
```

### 2. New AdminApiSyncService

#### Core Service Implementation

**AdminApiSyncService Core Implementation:**

• **Service Constructor:**

- Resolve dependencies for Admin API services (v1 and v2)
- Initialize entity managers and repositories
- Set up logging capabilities

• **Main Sync Method - `syncEnvironmentData()`:**

- **Purpose:** Main entry point for Admin API-based environment synchronization
- **Supports:** Both v1 and v2 Admin API versions
- **Process Flow:**
  - Validate environment has necessary Admin API configuration
  - Determine API version (v1 or v2) and select appropriate service
  - Discover and sync tenants based on multi-tenant configuration
  - Process tenant data using existing table structures
- **Return Value:** Returns `SyncResult` object containing status and tenant count for consistency with Starting Blocks sync

• **Tenant Sync Method - `syncTenantData()`:**

- **Purpose:** Syncs tenant-specific data including ODS instances and education organizations for individual tenants
- **Scope:** Public method for individual tenant synchronization (v2 only)
- **Operations:**
  - Validate tenant has environment with Admin API configuration
  - Use `getAdminApiClient` with tenant context for proper authentication
  - Retrieve ODS instances for the specified tenant
  - Get education organizations for each ODS instance
  - Transform and store data in existing structures without schema changes
  - Return processed sync result with status
- **Authentication:** Uses tenant-specific credentials and includes tenant header in API requests

• **Helper Method - `processTenantData()`:**

- **Purpose:** Private helper to process and persist a single tenant's data
- **Operations:**
  - Transform tenant data to EdfiTenant format
  - Find or create tenant in database
  - Persist ODS instances and education organizations using existing sync logic
  - Use transaction management for data consistency
- **Reusability:** Shared by both environment-level and tenant-level sync methods
  
```typescript

export class AdminApiSyncService {
  constructor(
    // Resolve dependencies
  ) {}

  async syncEnvironmentData(sbEnvironment: SbEnvironment): Promise<SyncResult> {
    // Validate environment has necessary Admin API configuration    
    // Determine version and get appropriate service    
    // Discover and sync tenants    
    // Process tenant data using existing table structures
  }

  async syncTenantData(edfiTenant: EdfiTenant): Promise<SyncResult> {
    // Get ODS instances for tenant    
    // Get education organizations for each ODS instance    
    // Transform and store data in existing structures
  }
}
```

### 3. Authentication and Token Management

#### Tenant-Specific Token Storage

**Multi-Tenant Authentication Pattern:**

• **Composite Token Keys:**
  - **Pattern:** `${environmentId}-${tenantName}`
  - **Purpose:** Each tenant maintains its own OAuth token to prevent credential sharing
  - **Implementation:** `getTenantTokenKey(environmentId, tenantName)` helper method
  - **Example:** Environment 123 with tenant1 uses key `123-tenant1`

• **Token Cache Management:**
  - **Storage:** NodeCache with automatic expiration based on token lifetime
  - **TTL:** Token expiry time minus 60 seconds for refresh buffer
  - **Isolation:** Prevents token collision between tenants in same environment

• **Login Method Enhancement:**
  - **Parameter:** `tenantName` parameter added to `login()` method
  - **Auto-Selection:** When no tenant specified, automatically selects first available tenant (prefers 'default')
  - **Storage:** Stores token using composite key for tenant-specific authentication
  - **Logging:** Records token storage with composite key for debugging

#### API Client Methods

**`getAdminApiClient(edfiTenant)`:**
- **Purpose:** Creates authenticated client for tenant-specific operations
- **Token Retrieval:** Uses composite key `${sbEnvironment.id}-${tenantName}`
- **Auto-Authentication:** Automatically logs in if token not found or expired
- **Headers:** Includes both `Authorization: Bearer {token}` and `tenant: {tenantName}`
- **Use Case:** All tenant-specific API operations (ODS instances, education organizations, etc.)

**`getAdminApiClientUsingEnv(environment)`:**
- **Purpose:** Creates authenticated client for environment-level operations
- **Token Retrieval:** Uses environment ID only
- **Limited Scope:** Used only for root endpoint (`/`) to check tenancy mode
- **Note:** Does NOT include tenant header - only for multi-tenant discovery

#### Authentication Flow

**Environment-Level Sync:**
1. Check tenancy mode using environment-level token (no tenant header)
2. Discover tenant names from API response
3. **For each tenant:**
   - Authenticate separately with tenant-specific credentials
   - Store token using composite key `${environmentId}-${tenantName}`
   - Fetch tenant data with tenant-specific token and tenant header

**Tenant-Level Sync:**
1. Retrieve tenant with environment relationship
2. Use `getAdminApiClient(tenant)` for automatic tenant-specific authentication
3. Include tenant header in all API requests
4. Fetch ODS instances and education organizations with proper tenant context

#### Multi-Tenant API Requirements

• **Tenant Header Requirement:**
  - **All Tenant-Specific Endpoints:** Must include `tenant: {tenantName}` header
  - **Examples:** `/tenants/{name}/OdsInstances/edOrgs`, ODS operations, education organizations
  - **Exception:** Root endpoint (`/`) for tenancy discovery does not require tenant header

• **Authentication Isolation:**
  - **Per-Tenant Credentials:** Each tenant has separate API key and secret
  - **Token Separation:** No token sharing between tenants prevents data leakage
  - **Authorization Boundary:** Each token only authorized for its specific tenant

### 4. Extended Admin API Service Methods

#### AdminApiServiceV1 Extensions

**AdminApiServiceV1 Method Extensions:**

• **`getTenants()` Method:**

- **Purpose:** Creates default tenant representation for single-tenant
  environments
- **Scope:** For v1 API, typically single tenant derived from environment config
- **Parameters:** `environment: SbEnvironment`
- **Returns:** `Promise<TenantDto[]>`
- **Implementation:**
  - Returns array with single default tenant object
  - Maps fields from environment data as needed

• **`getEducationOrganizations()` Method:**

- **Purpose:** Retrieve all education organizations for the tenant
- **Parameters:**
  - Instance ID (optional)
- **Admin API Endpoints:**
  - `/{version}/educationOrganizations` (general endpoint)
  - `/{version}/educationOrganizations/{instanceId}` (instance-specific)
- **Operations:**
  - Retrieve education organizations from Admin API endpoints
  - Transform API response to match expected format
  - Return processed education organization data

• **`getOdsInstancesForDefaultTenant()` Method:**

- **Purpose:** Retrieve ODS instances for the tenant
- **Admin API Endpoints:**
  - `/{version}/OdsInstances` (general endpoint)
- **Scope:** Maps existing metadata structure to ODS instance format
- **Operations:**
  - Retrieve ODS instance details Admin API endpoints
  - Transform metadata structure to standard ODS instance format
  - Handle single-tenant ODS instance mapping

#### AdminApiServiceV2 Extensions

**AdminApiServiceV2 Key Differences from V1:**

• **`getTenants()` Method - Primary Difference:**

- **V2 Advantage:** Queries tenancy information from root endpoint, then fetches detailed data per tenant
- **Endpoints:** 
  - `GET /` - Root endpoint for tenancy mode and tenant list discovery
  - `GET /v2/tenants/{tenantName}/OdsInstances/edOrgs` - Per-tenant details endpoint
- **Multi-Tenant Support:** Handles environments with multiple tenants
- **Parameters:** `environment: SbEnvironment`
- **Returns:** `Promise<TenantDto[]>`
- **Implementation Steps:**
  1. Call root endpoint to determine multi-tenant mode and get tenant names
  2. **Per-Tenant Authentication:** Login separately for each tenant using tenant-specific credentials
  3. **Parallel Fetch:** Use `Promise.all()` to fetch all tenant details concurrently
  4. **Tenant Context:** Include `tenant` header in each API request
  5. Transform response data including ODS instances and education organizations
- **Error Handling:** Gracefully handles per-tenant failures, returns tenant with empty details on error
- **Contrast with V1:** V1 creates default tenant from config, V2 fetches actual tenants from API with proper multi-tenant authentication

• **Shared Methods with V1 (Same Implementation Pattern):**

- **`getEducationOrganizations()` Method:**
  - **Same Purpose:** Retrieve education organizations for tenant
  - **Same API Pattern:** Uses `/{version}/educationOrganizations` endpoints
  - **Same Filtering:** Optional ODS instance filtering available
  - **Authentication:** Uses tenant-specific token via `getAdminApiClient(tenant)`

- **`getOdsInstancesForTenant()` Method:**
  - **Same Purpose:** Retrieve ODS instances for tenant
  - **Same API Pattern:** Uses ODS instances endpoints
  - **Same Data Handling:** Returns instance details with metadata
  - **Authentication:** Uses tenant-specific token via `getAdminApiClient(tenant)`

• **V1 vs V2 Summary:**

- **Primary Difference:** Tenant discovery (V2 uses API endpoint, V1 uses
  config)
- **Authentication Model:** V2 requires per-tenant authentication with composite token keys
- **API Headers:** V2 requires `tenant` header for all tenant-specific operations
- **Shared Functionality:** Education organizations and ODS instances use
  identical patterns
- **API Consistency:** Both versions use same endpoint structure for shared
  methods
- **Data Processing:** Both versions use the same data transformation logic to map API responses to the existing database schema

### 5. Data Transformation and Mapping

#### Adapting Admin API Responses to Existing Tables

**AdminApiDataAdapter - Data Transformation Utilities:**

• **Class Purpose:**

- **Core Function:** Maps Admin API responses to existing database entity
  structures
- **Key Benefit:** Enables data transformation without requiring schema changes
- **Compatibility:** Maintains existing database structure integrity

• **`transformTenantData()` Method:**

- **Purpose:** Transform Admin API tenant response to match EdfiTenant entity
- **Input Parameters:**
  - `tenantDto: TenantDto` - Admin API tenant response with ODS instances and education organizations
  - `sbEnvironment: SbEnvironment` - Environment context
- **Returns:** `Transformed tenant data` with nested ODS and education organization structures
- **Key Transformations:**
  - Maps `tenantDto.name` to tenant name field
  - Links tenant to environment via `sbEnvironment.id`
  - Processes ODS instances with their education organizations
  - Handles date conversion with fallback to current date
- **Schema Compatibility:** Maps v2 multi-tenant structure to existing database schema

• **`transformOdsInstanceData()` / ODS Instance Mapping:**

- **Purpose:** Transform Admin API ODS instance to match existing Ods entity structure
- **Input:** ODS instance data from Admin API response
- **Returns:** `SyncableOds` - Mapped ODS instance entity
- **Field Mappings:**
  - **Stable Identifier:** `odsInstanceId` (used for matching existing records)
  - Direct mapping: `name` → `odsInstanceName`
  - Computed: `dbName` (typically matches instance name)
  - Initialized: `edorgs` array populated from education organizations
- **Matching Strategy:** Uses `odsInstanceId` as the stable key for identifying existing ODS records
- **Change Detection:** Compares `odsInstanceName` to detect name changes
- **Update Logic:** 
  - Finds existing ODS by `odsInstanceId`
  - Updates `odsInstanceName` if changed
  - Preserves `dbName` from original creation

• **`transformEdorgData()` Method:**

- **Purpose:** Transform Admin API education organizations to match existing Edorg entity
- **Input:** Education organization data from API response
- **Returns:** `Edorg data` - Mapped education organization entity
- **Field Preservation Strategy:**
  - Core identifiers: `educationOrganizationId`, `discriminator`
  - Institution names: `nameOfInstitution`, `shortNameOfInstitution`
  - Hierarchy: `parentId` for organization relationships
  - Fallback logic: Uses `nameOfInstitution` if `shortNameOfInstitution` missing
- **Data Integrity:** Preserves all required fields for existing table structure

#### Sync Delta Computation

**ODS Matching and Update Logic:**

• **`computeOdsListDeltas()` Method:**
  - **Matching Key:** Uses `odsInstanceId` (stable Admin API identifier)
  - **Change Detection:** Compares names between existing and incoming ODS data
  - **Operations:**
    - **New:** Creates ODS instances not found in database
    - **Update:** Updates existing ODS when `odsInstanceName` changed
    - **Delete:** Marks ODS as inactive if no longer in Admin API response
  - **Logging:** Comprehensive logging of all comparisons and detected changes

• **`persistSyncTenant()` Method:**
  - **Transaction Safety:** All updates wrapped in database transaction
  - **ODS Matching:** Maps ODS by `odsInstanceId` in three locations
  - **Save Operations:**
    - Saves new ODS instances
    - Updates existing ODS instance names
    - Processes education organizations for each ODS
  - **Error Handling:** Rolls back entire transaction on any failure

### 6. Error Handling and Retry Logic

#### Error Types

• **Auth Failed (`AUTH_FAILED`):** Authentication or authorization issues
(401/403 errors)

• **Network Error (`NETWORK_ERROR`):** Connectivity issues like
unreachable endpoints

• **API Error (`API_ERROR`):** General API failures
including rate limiting (429) and server errors (5xx)

• **Data Transform Error (`DATA_TRANSFORM_ERROR`):** Issues processing API response data

#### Retry Logic

• **Maximum Attempts:** 3 retry attempts for eligible errors

• **Backoff Strategy:** Exponential backoff with delays of 2s, 4s, 8s between attempts

• **Retry Conditions:** Retries occur for network errors, authentication failures,
and server-side API errors (5xx)

• **Non-Retryable:** Client errors (4xx except
401/403) and data transformation errors are not retried

### 7. Tenant Management Strategy

#### Automatic Tenant Discovery

• **Read-Only Operations:** Admin API integration supports tenant reading via
`/tenants` endpoint but does not support tenant creation or deletion

• **Configuration-Based Management:** Tenant lists are maintained through Admin
API configuration files (appsettings) or environment variable overrides

• **Automatic Cache Updates:** When tenant configuration is updated in
appsettings or via environment variables, the Admin API tenant cache refreshes
automatically

• **Sync Integration:** Both manual "Sync SB" operations and scheduled sync jobs
automatically retrieve the latest tenant list from the refreshed cache

• **No Manual Reload Required:** The automatic cache refresh mechanism
eliminates the need for manual tenant list reloading operations. As a result,
the `Reload tenants` option will be hidden for `Non-StartingBlocks` environments

### 8. Consolidated list of Admin API endpoints

The following Admin API endpoints are utilized throughout this integration:

#### Root Endpoint (Multi-Tenant Discovery)

• **Tenancy Information:**

- `GET /` - Root endpoint to retrieve tenancy mode and tenant list
- **Response Fields:**
  - `tenancy.multitenantMode` (boolean) - Indicates if multi-tenant mode enabled
  - `tenancy.tenants` (string[]) - Array of tenant names
- **Usage:** Initial tenant discovery in v2 environments
- **Authentication:** Requires environment-level token (no tenant header)

#### V2 Multi-Tenant Endpoints

• **Tenant Details:**

- `GET /v2/tenants/{tenantName}/OdsInstances/edOrgs` - Retrieve complete tenant data
- **Response:** ODS instances with nested education organizations
- **Headers Required:**
  - `Authorization: Bearer {tenant-specific-token}`
  - `tenant: {tenantName}`
- **Usage:** Primary data retrieval endpoint for tenant synchronization

#### V1 and V2 Common Endpoints

• **Education Organizations:**

- `GET /{version}/educationOrganizations` - Retrieve all education organizations
- `GET /{version}/educationOrganizations/{instanceId}` - Retrieve education
  organizations for specific ODS instance
- **Usage:** Core data retrieval for both V1 and V2 implementations
- **Authentication:** Requires tenant-specific token and tenant header for v2

• **ODS Instances:**

- `GET /{version}/OdsInstances` - Retrieve ODS instances for tenant
- **Usage:** Instance discovery and metadata retrieval
- **Authentication:** Requires tenant-specific token and tenant header for v2

#### Alternative Endpoints (Future Implementation)

• **ODS Instance Metadata:**

- `GET /{version}/OdsInstances/metadata` - Enhanced metadata retrieval
- **Status:** Planned replacement for education organizations endpoint
- **Purpose:** Enables more efficient data retrieval by using the metadata
  structure, which provides ODS instance details along with the list of
  education organizations

#### Endpoint Usage Patterns

• **Version Support:** All endpoints support both V1 and V2 API versions via `{version}` parameter

• **Authentication Requirements:**
  - **Environment-Level:** Root endpoint (`/`) uses environment-level token without tenant header
  - **Tenant-Specific:** All tenant operations require tenant-specific token using composite key pattern
  - **Tenant Header:** V2 multi-tenant endpoints require `tenant: {tenantName}` header
  - **Token Isolation:** Each tenant maintains its own OAuth token to prevent credential sharing

• **Error Handling:** 
  - Standard HTTP status codes with retry logic for 5xx errors and rate limiting (429)
  - 401 errors trigger re-authentication with tenant-specific credentials
  - Per-tenant error handling in parallel operations

## Implementation Status

### Completed Features

✅ **Tenant-Specific Authentication**
- Composite token key pattern (`${environmentId}-${tenantName}`)
- Per-tenant OAuth token storage and retrieval
- Automatic login with tenant-specific credentials

✅ **Environment-Level Sync**
- Multi-tenant discovery via root endpoint
- Parallel tenant data fetching with per-tenant authentication
- Comprehensive error handling and logging

✅ **Tenant-Level Sync**
- Individual tenant synchronization support (v2 only)
- Proper authentication using `getAdminApiClient(tenant)`
- Tenant header inclusion in all API requests

✅ **Data Synchronization**
- ODS instance matching by stable `odsInstanceId`
- Change detection for ODS name updates
- Education organization relationship mapping
- Transaction-safe persistence operations

✅ **User Interface Updates**
- Sync button visibility for v2 environments
- Sync queue display for both Starting Blocks and v2 environments
- Support for both environment and tenant-level sync actions

### Configuration Requirements

**Multi-Tenant Environment Configuration:**

```json
{
  "version": "v2",
  "tenants": {
    "tenant1": {
      "adminApiKey": "key_for_tenant1",
      "adminApiSecret": "secret_for_tenant1",
      "allowedEdorgs": [...]
    },
    "tenant2": {
      "adminApiKey": "key_for_tenant2",
      "adminApiSecret": "secret_for_tenant2",
      "allowedEdorgs": [...]
    }
  }
}
```

**Key Points:**
- Each tenant must have separate API credentials
- Credentials stored in environment configuration (public key, private secret)
- Tenant names must match those returned by Admin API root endpoint
