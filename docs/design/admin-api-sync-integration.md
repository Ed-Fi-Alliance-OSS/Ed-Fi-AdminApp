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

• **Tenant Sync Method - `syncTenantData()`:**

- **Purpose:** Syncs tenant-specific data including ODS instances and education
  organizations
- **Scope:** Private method for internal tenant processing
- **Operations:**
  - Retrieve ODS instances for the specified tenant
  - Get education organizations for each ODS instance
  - Transform and store data in existing structures without schema changes
  - Return processed sync result with status
  
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

### 3. Extended Admin API Service Methods

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

- **V2 Advantage:** Queries tenants endpoint directly from Admin API
- **Endpoint:** `/{version}/tenants`
- **Multi-Tenant Support:** Handles environments with many tenants
- **Parameters:** `environment: SbEnvironment`
- **Returns:** `Promise<GetTenantDtoV2[]>`
- **Implementation:**
  - Makes API call to `/tenants`
  - Transforms response data using `transformTenantResponse()`
  - Supports pagination for large tenant lists
- **Contrast with V1:** V1 creates default tenant from config, V2 fetches actual
  tenants from API

• **Shared Methods with V1 (Same Implementation Pattern):**

- **`getEducationOrganizations()` Method:**
  - **Same Purpose:** Retrieve education organizations for tenant
  - **Same API Pattern:** Uses `/{version}/educationOrganizations` endpoints
  - **Same Filtering:** Optional ODS instance filtering available

- **`getOdsInstancesForTenant()` Method:**
  - **Same Purpose:** Retrieve ODS instances for tenant
  - **Same API Pattern:** Uses ODS instances endpoints
  - **Same Data Handling:** Returns instance details with metadata

• **V1 vs V2 Summary:**

- **Primary Difference:** Tenant discovery (V2 uses API endpoint, V1 uses
  config)
- **Shared Functionality:** Education organizations and ODS instances use
  identical patterns
- **API Consistency:** Both versions use same endpoint structure for shared
  methods
- **Data Processing:** Both versions use the same data transformation logic to map API responses to the existing database schema

### 4. Data Transformation and Mapping

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
  - `apiTenant: GetTenantDtoV2` - Admin API tenant response
  - `sbEnvironment: SbEnvironment` - Environment context
- **Returns:** `Partial<EdfiTenant>` - Mapped tenant entity
- **Key Transformations:**
  - Maps `apiTenant.name` to tenant name field
  - Links tenant to environment via `sbEnvironment.id`
  - Handles date conversion with fallback to current date
- **Schema Compatibility:** Maps v2 multi-tenant structure to existing
  single-tenant database schema

• **`transformOdsInstanceData()` Method:**

- **Purpose:** Transform Admin API ODS instance to match existing Ods entity
  structure
- **Input:** `apiOds: GetOdsInstanceDetailDtoV2` - Admin API ODS instance
  response
- **Returns:** `SyncableOds` - Mapped ODS instance entity
- **Field Mappings:**
  - Direct mapping: `id`, `name`, `instanceType`
  - Computed: `dbName` (extracted from education organizations metadata)
  - Initialized: `edorgs` as empty array (populated separately)
  - Converted: `created` date from API response

• **`transformEdorgData()` Method:**

- **Purpose:** Transform Admin API education organizations to match existing
  Edorg entity
- **Input:** `apiEdorg: GetEducationOrganizationDtoV2` - Admin API education org
  response
- **Returns:** `Partial<Edorg>` - Mapped education organization entity
- **Field Preservation Strategy:**
  - Core identifiers: `educationOrganizationId`, `discriminator`
  - Institution names: `nameOfInstitution`, `shortNameOfInstitution`
  - Fallback logic: Uses `nameOfInstitution` if `shortNameOfInstitution`
- **Data Integrity:** Preserves all required fields for existing table structure

### 5. Error Handling and Retry Logic

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

### 6. Tenant Management Strategy

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

### 7. Consolidated list of Admin API endpoints

The following Admin API endpoints are utilized throughout this integration:

#### V1 and V2 Common Endpoints

• **Education Organizations:**

- `GET /{version}/educationOrganizations` - Retrieve all education organizations
- `GET /{version}/educationOrganizations/{instanceId}` - Retrieve education
  organizations for specific ODS instance
- **Usage:** Core data retrieval for both V1 and V2 implementations

• **ODS Instances:**

- `GET /{version}/OdsInstances` - Retrieve ODS instances for tenant
- **Usage:** Instance discovery and metadata retrieval

#### V2-Specific Endpoints

• **Tenants Management:**

- `GET /{version}/tenants` - Retrieve all tenants in multi-tenant environments
- **Usage:** Primary tenant discovery mechanism for V2 environments

#### Alternative Endpoints (Future Implementation)

• **ODS Instance Metadata:**

- `GET /{version}/OdsInstances/metadata` - Enhanced metadata retrieval
- **Status:** Planned replacement for education organizations endpoint
- **Purpose:** Enables more efficient data retrieval by using the metadata
  structure, which provides ODS instance details along with the list of
  education organizations

#### Endpoint Usage Patterns

• **Version Support:** All endpoints support both V1 and V2 API versions via `{version}` parameter

• **Authentication:** All endpoints require proper Admin
API authentication credentials

• **Error Handling:** Standard HTTP status codes
with retry logic for 5xx errors and rate limiting (429)
