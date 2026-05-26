# Admin App Product Requirements Document for Version 4.1

> **Status:** draft \
> **Owner:** Stephen Fuqua, Ed-Fi Alliance \
> **Jira Project:** AC \
> **Repository:** `Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp` \
> **Baseline PRD:** [Admin App Product Requirements Document for Version 4.0](./PRD-AdminApp-v4.0.md)

## 1. Product Overview

Admin App v4.1 builds on the v4.0 release by creating or improving the workflows
administrators use to manage API client credentials,  keep Admin App
synchronized with the Ed-Fi ODS/API and ODS Admin API, and manage database
instances. This PRD is a release delta: it complements the v4.0 PRD rather than
replacing the product overview, personas, enterprise architecture, and baseline
requirements already captured there.

This PRD focuses on end-user functionality only. It intentionally excludes
technical debt, bug fixes, security hardening tasks, infrastructure work,
dependency upgrades, automated tests, and documentation-only tickets unless they
directly define user-visible behavior. These tasks are important and are part of
the next release, but they will not be described in this document.

### 1.2 Release Objectives

#### Must Have Objectives

1. Manage multiple credential sets for an application without treating the
   application itself as the credential. (Previously, Application was treated as
   1-1 with Credential.)

   ```mermaid
   erDiagram
     direction LR
     Vendor ||--o{ Application : has
     Application ||--|{ Credentials : has
   ```

2. Synchronize Admin App data with non-Starting Blocks Ed-Fi deployments.
   1. ODS Instances and related data
   2. Education organizations
3. Create and manage database instances from a database template.
4. Refine the user experience around tenants and environments.

#### Should Have Objectives

1. Help the user better understand the implications of a given claimset and/or profile.

### 1.3 Carried-Forward Product Context

The target markets, personas, and jobs to be done from the v4.0 PRD remain valid
for v4.1. The most affected personas are:

- **SEA System Administrator** and **Managed Service Provider System
  Administrator**, who need clearer authorization information and reliable
  synchronization across deployments.
- **Operator**, who needs safe, understandable credential management workflows.
- **Ed-Fi Alliance Certification Manager**, who needs to manage credentials and
  understand claimsets/profiles across demonstration environments.

## 2. Jobs to Be Done

> [!TIP]
> The JTBD numbering continues from the PRD for v4.0.

### JTBD 1: Issue Credentials (Modified)

**Personas:** SEA System Administrator, Managed Service Provider System
Administrator, Operator, Ed-Fi Alliance Certification Manager

**Original User Story**: When supporting a new application integration to an
existing Ed-Fi API deployment, I want to perform basic CRUD operations for
Vendors, Applications, and Credentials, so that I can distribute OAuth
credentials ("key and secret") to the vendor.

_Augment the story above with this new one:_

**When** an application has _one or more API credential sets_, \
**I want** to view, create, edit, reset, deactivate, and delete those credential sets directly, \
**so that** I can (a) manage access without confusing credentials with the parent
application and (b) manually manage overlapping key/secret pairs for **key rotation** security.

**How Admin App Helps:** The v4.0 PRD described a one-to-one relationship between an
application and credentials. Version 4.1 introduces explicit credential-level
management screens and actions.

### JTBD 6: Synchronize with Running Ed-Fi Deployments

**Personas:** SEA System Administrator, Managed Service Provider System
Administrator

**When** Admin App is connected to an Ed-Fi ODS/API and Admin API deployment, \
**I want** to synchronize its database with current environment, tenant,
ODS instance, and education organization data, \
**so that** Admin App reflects the deployment I am administering without
requiring manual database management or reliance on Starting Blocks environment
models.

**How Admin App Helps:** Synchronization behavior that previously existed for Starting
Blocks environments is generalized for non-Starting Blocks deployments, with
refresh and job-status handling for long-running data updates.

### JTBD 7: Evaluate Claimsets and Profiles

**Personas:** SEA System Administrator, Managed Service Provider System
Administrator, Operator, Ed-Fi Alliance Certification Manager

**When** configuring an application for an Ed-Fi API integration, \
**I want** to understand what a claimset or profile allows, \
**so that** I can choose an appropriate authorization configuration and explain
the resulting access limitations to others.

**How Admin App Helps:** The v4.0 PRD allowed users to view, export, and import claimset
and profile definitions. Version 4.1 adds richer, more human-readable views and
drilldown behavior.

## 3. Functional Requirements

### Application Credential Management

- **FR-APP-9:** From an application page, the application SHALL provide a
  credential management action that navigates to the list of credential sets for
  that application.
- **FR-APP-10:** The credential list SHALL show each credential set associated
  with the application and SHALL include clear enabled/disabled status
  indicators.
- **FR-APP-11:** The credential list SHALL label the Ed-Fi API client identifier
  as **Key** in the user interface.
- **FR-APP-12:** The credential list SHALL NOT include sandbox-specific fields that are
  not meaningful in the Admin App workflow.
- **FR-APP-13:** Users with appropriate permissions SHALL be able to open a
  credential detail page from the credential list.
- **FR-APP-14:** The credential detail page SHALL show relevant information for
  the credential set and provide available actions to reset, edit, and delete the
  credential set.
- **FR-APP-15:** Users with appropriate permissions SHALL be able to create a new
  credential set for an application by entering credential name, approval status,
  and ODS assignment.
- **FR-APP-16:** When a credential set is created, the application SHALL deliver
  generated credentials through the configured credential delivery mode,
  including Yopass or internal display.
- **FR-APP-17:** Users with appropriate permissions SHALL be able to edit
  credential name, approval status, and ODS assignment.
- **FR-APP-18:** Fields that are not editable for a credential set SHALL be
  displayed as read-only rather than hidden when they are relevant for user
  understanding.
- **FR-APP-19:** Users with appropriate permissions SHALL be able to reset a
  credential set from the credential detail page.
- **FR-APP-20:** Credential reset SHALL deliver the new credential secret through
  the configured credential delivery mode, including Yopass or internal display.
- **FR-APP-21:** Users with appropriate permissions SHALL be able to delete a
  credential set using the same confirmation behavior used by other destructive
  actions in the application.
- **FR-APP-22:** Credential list, detail, create, edit, delete, and reset flows
  SHALL provide breadcrumbs consistent with the rest of Admin App.
- **FR-APP-23:** Users with appropriate permissions SHALL be able to deactivate a
  credential set so that it temporarily cannot be used to access the ODS/API.
- **FR-APP-24:** If Admin App still exposes one credential set per application,
  deactivation SHALL be available from the application credential edit
  experience. If Admin App exposes multiple credential sets per application,
  deactivation SHALL be available at the credential-set level.

### Synchronization of Environments

The application SHALL support synchronization between the Admin
App database and running Ed-Fi ODS/API and Admin API instances that are not
Starting Blocks environments through the following detailed requirements:

- **FR-SYNC-1:** The synchronization user experience SHALL avoid Starting Blocks
  terminology when the connected deployment is not a Starting Blocks deployment.
- **FR-SYNC-2:** The application SHALL use the Management API refresh behavior for
  **education organization data** when that behavior is available.
- **FR-SYNC-3** / **FR-ODS-3:** The application SHALL use the Management API refresh behavior for
  **ODS instance configurations** when that behavior is available.
  - Resolves a known caveat on FR-ODS-2 from the v4.0 PRD.
- **FR-SYNC-4:** If a synchronization refresh job fails, the application SHALL
  communicate the failure to the user and SHALL NOT present stale or partial data
  as a successful refresh.
- **FR-SYNC-5** When a refresh request returns a job identifier, the application
  SHALL poll the corresponding job-status endpoint until the job completes before
  fetching dependent synchronized data.
- **FR-SYNC-6:** The application SHALL make synchronization progress and waiting
  states understandable to the user when a refresh job is still running.

### Environment Configuration and Tenant-Mode Validation

- **FR-ENV-5:** When creating or editing an environment, the application SHALL
  determine the tenant mode configured in the connected Admin API when the Admin
  API exposes that information.
- **FR-ENV-6:** The application SHALL use tenant-mode information to validate
  that the Admin App environment configuration is compatible with the connected
  Admin API.
- **FR-ENV-7:** When tenant-mode validation fails, the application SHALL display a
  user-actionable error message during environment setup or editing.

### Authentication Provider Compatibility

> [!WARNING]
> This is an important, but speculative, set of requirements. Further refinement
> may be needed after the engineering support team investigates the current
> integration capabilities.

- **FR-AUTH-6:** The application SHALL validate Microsoft Entra ID as a supported
  OIDC identity provider option for Admin App authentication.
- **FR-AUTH-7:** The application SHOULD document any Microsoft Entra ID
  configuration limitations discovered during validation as product limitations
  or setup guidance.
- **FR-AUTH-8:** Follow-up product work SHALL be identified if Microsoft Entra ID
  validation reveals end-user authentication behavior that differs materially
  from the Keycloak reference implementation.

### Claimset Display and Drilldown

- **FR-CS-3:** The application SHALL allow users to review the resource claims
  included in a claimset from within the existing claimset user experience.
  - Replaces the FR-CS-3 roadmap item from the v4.0 PRD.
- **FR-CS-4:** The application SHALL retrieve claimset hierarchy details from the
  Admin API when those details are available.
- **FR-CS-5:** When a claimset includes parent resource claims, the application
  SHALL allow the user to drill into or expand those parent claims to see child
  resource claims.
- **FR-CS-6:** Claimset drilldown SHALL support multiple levels of nesting when
  the Admin API provides nested hierarchy data.
- **FR-CS-7:** The claimset display SHOULD make it clear which displayed
  resources are parent categories and which are concrete child resources.

### Profile Display and Interpretation

- **FR-PROFILE-3:** The application SHALL provide a click-through user experience
  for viewing the details of an ODS/API profile.
  - Replaces the FR-PROFILE-3 roadmap item from the v4.0 PRD.
- **FR-PROFILE-4:** The application SHALL present profile information in a form
  that helps administrators understand what the profile allows without requiring
  them to read raw XML as the primary experience.
- **FR-PROFILE-5:** The application SHALL allow users to copy or download the
  human-readable profile representation so that it can be shared with integration
  partners or internal support staff.
- **FR-PROFILE-6:** The application MAY continue to expose the original profile
  XML as supporting detail, but the original XML SHALL NOT be the only way to
  understand profile behavior.
- **FR-PROFILE-7:** The application SHALL avoid sending profile content to
  third-party AI services as part of the hosted product experience.

## 4. Non-Functional Requirements

This release PRD only adds non-functional requirements that directly affect
end-user behavior for the v4.1 functionality.

- **NFR-UX-1:** Long-running synchronization actions SHALL provide visible user
  feedback while work is pending.
- **NFR-COMPAT-5:** Microsoft Entra ID SHALL be validated as an OIDC provider for
  the authentication flow used by Admin App.
- **NFR-COMPAT-6:** Synchronization behavior SHALL support non-Starting Blocks
  Ed-Fi deployments in addition to any Starting Blocks-specific behavior already
  present.
- **NFR-SEC-3:** Credential creation and reset flows SHALL preserve the v4.0
  one-time secret handling expectations, including configured Yopass behavior.

## 5. System Architecture Implications

The v4.0 enterprise architecture remains the baseline. Version 4.1 introduces the
following product-level architecture implications:

| Area | Implication |
| --- | --- |
| Claimsets | Admin App depends on Admin API resource-claim hierarchy data to support claimset drilldown. |
| Profiles | Admin App needs a profile representation suitable for human reading, copying, and downloading. |
| Credentials | Application credential sets become an explicit user-managed resource beneath applications. |
| Synchronization | Admin App must support refresh requests that return asynchronous job identifiers and job-status polling. |
| Environment setup | Admin App consumes Admin API tenant-mode metadata when available. |
| Authentication | Microsoft Entra ID is validated as a field-relevant OIDC provider in addition to Keycloak. |

## 6. Out of Scope

- AI-generated explanations that require sending customer deployment data to a
  hosted third-party AI service.

## 7. Glossary Additions

- **Credential Set:** A user-managed API credential record associated with an
  application. It includes a key, secret-handling behavior, status, approval
  state, and ODS assignment as exposed by Admin App.
- **Human-Readable Profile Representation:** A profile view intended for
  administrator comprehension and sharing, rather than raw XML inspection.
- **Job Status Endpoint:** An Admin API endpoint used by Admin App to determine
  whether an asynchronous refresh job is pending, complete, or failed.
- **Non-Starting Blocks Deployment:** An Ed-Fi deployment that is not managed
  through the Starting Blocks environment model but still needs Admin App
  synchronization.
- **Tenant Mode:** The Admin API deployment setting that determines whether the
  connected environment operates in single-tenant or multi-tenant mode.

## 8. Open Questions

Answers to these questions will be determined during the implementation work.

- Should profile details use a tree, table, diagram, prose summary, or a
  combination of these formats as the primary human-readable representation?
- Should deactivated credentials remain visible by default in credential lists,
  or should they be hidden behind a filter?
- What synchronization terminology should replace Starting Blocks-specific labels
  in non-Starting Blocks deployments?
- What job-status states and failure reasons will the Admin API expose to Admin
  App users?
