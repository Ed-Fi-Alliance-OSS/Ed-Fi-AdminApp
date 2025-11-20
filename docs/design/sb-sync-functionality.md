# SB Sync Functionality Documentation

## Overview

The SB Sync functionality is a synchronization system that keeps the Ed-Fi Admin App 4.0 database in sync with AWS Starting Blocks environments. This document explains what the sync does and how it works.

## What SB Sync Does

SB Sync is a **one-way synchronization system** that pulls data from AWS Starting Blocks environments into the Admin App database. Starting Blocks is considered the **source of truth**, and the Admin App database is updated to match the Starting Blocks state.

### Data Synchronized

The sync process handles the following types of data:

1. **Environment Metadata**: Configuration information about the Starting Blocks environment
2. **Tenants**: List of tenants in the Starting Blocks environment
3. **ODS Instances**: Database instances for each tenant (staging, production, different years)
4. **Education Organizations**: Education organization records from each ODS instance
5. **Admin API Credentials**: Authentication credentials for accessing Ed-Fi Admin APIs

### Sync Direction

```json
Starting Blocks Environment (AWS) → Admin App Database (PostgreSQL)
```

- **One-way sync**: Changes flow only from Starting Blocks to Admin App
- **No reverse sync**: Changes made in Admin App are not pushed back to Starting Blocks
- **Overwrite behavior**: Admin App database is updated to match Starting Blocks state

## Architecture Overview

### AdminApp-Starting Blocks Interaction Types

**Important**: There are **two distinct types** of interaction between AdminApp and Starting Blocks:

#### 1. Sync Operations ("Sync with SB" button)

- **Direction**: One-way FROM Starting Blocks TO AdminApp only
- **Purpose**: Refresh AdminApp database with latest Starting Blocks state
- **Behavior**: Overwrites AdminApp data to match Starting Blocks
- **Trigger**: "Sync with SB" button or scheduled jobs
- **Methods**: `refreshSbEnvironment()`, `refreshEdfiTenant()`

#### 2. Resource Management Operations (Separate API endpoints)

- **Direction**: AdminApp TO Starting Blocks (through Lambda calls)
- **Purpose**: Create/modify/delete resources in Starting Blocks
- **Behavior**: Calls Lambda functions, then updates local AdminApp database
- **Trigger**: Explicit user actions (Create Tenant, Delete ODS, etc.)
- **Methods**: `createTenant()`, `deleteOds()`, `createEdorg()`, etc.

**Key Point**: The "Sync with SB" button does NOT push AdminApp changes to Starting Blocks. It only pulls the latest Starting Blocks state into AdminApp.

### Core Components

1. **SbSyncConsumer** (`packages/api/src/sb-sync/sb-sync.consumer.ts`)
   - Orchestrates the sync process
   - Manages job scheduling using PgBoss
   - Handles error logging and recovery

2. **MetadataService** (`packages/api/src/teams/edfi-tenants/starting-blocks/metadata.service.ts`)
   - Invokes AWS Lambda functions
   - Handles authentication and error handling for Lambda calls

3. **StartingBlocksServiceV1/V2**
   - Version-specific sync implementation
   - Transforms Lambda response data
   - Updates Admin App database

4. **PgBoss Job Queue**
   - Manages scheduled and on-demand sync jobs
   - Provides job queuing and error recovery
   - Ensures single sync per environment (prevents conflicts)

### Lambda Function Integration

The sync process heavily relies on AWS Lambda functions to bridge the gap between Starting Blocks resources and the Admin App:

#### V1 Lambda Functions

- Single metadata Lambda function
- Returns basic tenant and ODS information
- Limited multi-tenant support

#### V2 Lambda Functions

- **tenantManagementFunctionArn**: Manages tenant operations
- **tenantResourceTreeFunctionArn**: Retrieves tenant resource hierarchy
- **odsManagementFunctionArn**: Manages ODS instance operations
- **edorgManagementFunctionArn**: Handles education organization data

#### Detailed Lambda Function Explanations

##### 1. tenantManagementFunctionArn

This Lambda function serves as the central tenant management service in Starting Blocks:

**Functionality:**

- Creates new tenants in the Starting Blocks infrastructure
- Deletes existing tenants and their associated resources
- Modifies tenant configurations (name, description, settings)
- Retrieves tenant metadata (credentials, database connection strings)

**AWS Resources Accessed:**

- DynamoDB tenant tables
- IAM role configurations
- CloudFormation stacks for tenant resources
- Parameter Store for tenant settings

##### 2. tenantResourceTreeFunctionArn

This Lambda function maps the entire resource hierarchy for a specific tenant:

**Functionality:**

- Builds a comprehensive tree of all tenant resources
- Maps relationships between ODS instances and education organizations
- Provides metadata for each resource (creation date, status, version)
- Serves as the primary data source for the sync process

**Response Structure Example:**

```json
{
  "tenant": "district1",
  "odsInstances": [
    {
      "name": "production",
      "dbName": "EdFi_Ods_2023",
      "status": "active",
      "edorgs": [
        {
          "educationorganizationid": 255901,
          "nameofinstitution": "Grand Bend ISD",
          "discriminator": "edfi.LocalEducationAgency"
        }
      ]
    }
  ]
}
```

##### 3. odsManagementFunctionArn

This Lambda function manages ODS database instances within a tenant:

**Functionality:**

- Creates new ODS instances from templates
- Deletes existing ODS instances and their databases
- Retrieves connection information for ODS databases
- Manages ODS database backups and restores
- Provides status monitoring for ODS instances

**AWS Resources Accessed:**

- RDS database instances
- RDS parameter groups
- CloudWatch logs and metrics
- S3 buckets for backup storage

##### 4. edorgManagementFunctionArn

This Lambda function handles education organization data within ODS databases:

**Functionality:**

- Queries ODS databases directly for education organization records
- Creates new education organizations in ODS databases
- Manages education organization hierarchies (districts, schools)
- Validates education organization IDs against ODS schema
- Synchronizes education organization data across systems

**Database Operations Example:**

```sql
-- Example query used by the Lambda function
SELECT 
  EducationOrganizationId,
  NameOfInstitution,
  ShortNameOfInstitution,
  Discriminator
FROM 
  edfi.EducationOrganization
WHERE 
  EducationOrganizationId = :educationOrganizationId
```

#### Lambda Function Role

```
Admin App → Lambda Functions → Starting Blocks AWS Resources
                ↓
         Direct database queries to:
         - RDS (ODS databases)
         - DynamoDB tables
         - Other AWS resources
```

## Sync Process Flow

### 1. Scheduled Sync

```typescript
// Runs on configurable cron schedule (config.SB_SYNC_CRON)
await this.boss.schedule(SYNC_SCHEDULER_CHNL, config.SB_SYNC_CRON, null, {
  tz: 'America/Chicago',
});
```

The scheduler:

- Identifies environments with Starting Blocks configuration (`sbEnvironmentMetaArn is not null`)
- Creates individual sync jobs for each environment
- Uses singleton keys to prevent duplicate jobs

### 2. Environment-Level Sync

```typescript
async refreshSbEnvironment(sbEnvironmentId: number)
```

**Process:**

1. Retrieves environment configuration from database
2. Calls `metadataService.getMetadata()` to invoke Lambda functions
3. Determines version (v1 vs v2) using `isSbV2MetaEnv()`
4. Calls appropriate service method:
   - `sbServiceV1.syncEnvironmentEverything()` for v1
   - `sbServiceV2.syncEnvironmentEverything()` for v2
5. Updates entire environment configuration, tenants, and ODS instances

### 3. Tenant-Level Sync

```typescript
async refreshEdfiTenant(edfiTenantId: number)
```

**Process:**

1. Retrieves specific tenant from database
2. Gets metadata from Lambda functions
3. Calls version-specific `syncTenantResourceTree()` method
4. Updates ODS instances and education organizations for that tenant only

### 4. Data Persistence

The sync process uses transaction-based database operations:

- `persistSyncTenant()`: Creates/updates tenant records
- `persistSyncOds()`: Creates/updates ODS instance records  
- `persistSyncDeleteOds()`: Removes ODS instances no longer in Starting Blocks

## Version Differences

### V1 (Simple Mode)

- **Single tenant**: Called "default"
- **Basic sync**: Limited to ODS instances and education organizations
- **Simple configuration**: Minimal setup requirements
- **Legacy support**: For older Starting Blocks deployments

### V2 (Full Mode)  

- **Multi-tenant**: Full support for multiple tenants per environment
- **Advanced features**: Admin API credential management, resource trees
- **Complex configuration**: Multiple Lambda functions and detailed setup
- **Current standard**: For new Starting Blocks deployments

## ODS Instance Behavior by Ed-Fi Version

### ODS/API 7.3 (Multi-tenant)

- **Tenant page lists**: All ODS instances within that tenant
- **Instance types**: Production, staging, different school years
- **Management**: Full CRUD operations through `OdsMgmtServiceV2`
- **Resource trees**: Hierarchical organization of ODS instances and education organizations

### ODS/API 6.2 (Single-tenant)

- **Limited support**: Currently shows error for single-tenant mode
- **Expected behavior**: Would show district/year-specific instances if supported
- **Current status**: "Single Tenant Mode is currently not supported by SBAA"

## Conclusion

The SB Sync functionality provides robust synchronization between AWS Starting Blocks environments and the Ed-Fi Admin App. While currently tied to AWS infrastructure through Lambda functions, the architecture demonstrates the patterns needed for synchronizing distributed Ed-Fi deployments.

For non-Starting Blocks environments, equivalent functionality would need to be developed using direct Ed-Fi API integration, representing a significant architectural shift from Lambda-based to API-based synchronization.

## Related Files

- `packages/api/src/sb-sync/sb-sync.consumer.ts` - Main sync orchestrator
- `packages/api/src/teams/edfi-tenants/starting-blocks/v1/starting-blocks.v1.service.ts` - V1 sync implementation
- `packages/api/src/teams/edfi-tenants/starting-blocks/v2/starting-blocks.v2.service.ts` - V2 sync implementation  
- `packages/api/src/teams/edfi-tenants/starting-blocks/metadata.service.ts` - Lambda function interface
- `packages/api/src/sb-sync/sync-ods.ts` - Database persistence operations
