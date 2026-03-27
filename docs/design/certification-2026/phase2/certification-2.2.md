# AC-479 - Technical Brief for Certification Release 2.2 (Phase 2)

- [1. Purpose](#1-purpose)
- [2. Executive Summary](#2-executive-summary)
- [3. Certification 2.1 Recap](#3-certification-21-recap)
- [4. Certification 2.2 Scope Boundaries](#4-certification-22-scope-boundaries)
- [5. Architecture Overview](#5-architecture-overview)
- [6. Certification Lifecycle](#6-certification-lifecycle)
- [7. Phase 2 Certification Workflow](#7-phase-2-certification-workflow)
- [8. Certification Database Schema](#8-certification-database-schema)
- [9. Security Gaps and Recommendations](#9-security-gaps-and-recommendations)
- [10. Additional or Future Nice-to-Have Features](#10-additional-or-future-nice-to-have-features)
- [11. Delivery Constraints, Risks, and Mitigations](#11-delivery-constraints-risks-and-mitigations)
- [12. Open Questions](#12-open-questions)
- [Appendix A - Retained Story Details](#appendix-a---retained-story-details)
- [Appendix B - POCs and Feasibility Notes](#appendix-b---pocs-and-feasibility-notes)
- [Appendix C - Certification 2026 Sequence Workflows](#appendix-c---certification-2026-sequence-workflows)

## 1. Purpose

This document defines the technical scope and delivery plan for Certification Release 2.2 (Phase 2) in Admin App.

The goal is to deliver the main funtionalities of the certification experience that allows vendors to run certification checks withing the Admin APP, aligned with the 2026 project direction to move toward same-day certification.

References used:

- [Certification Project 2026](https://edfi.atlassian.net/wiki/spaces/OTD/pages/1894154241/Certifications+Project+2026) overview (Atlassian summary provided by stakeholder).
- [Certification 2.1](../CERT-220/certification-2.1.md) (Techical Brief).

## 2. Executive Summary

Phase 2 modernizes this by integrating Bruno execution into Admin App with a simple user flow:

1. User Creates an Application and Credentials (Sandbox).
2. User selects the environment, and then opens the Certification module.
3. User inputs custom credentials (or use cached credentials).
4. User selects a Data Standard version (4 or 5).
5. User selects a certification scenario.
6. User selects a scenario step.
7. User provides required parameters and submits for validation.
8. Admin App validates inputs and allowlisted scenario path.
9. Admin App runs `Bruno CLI` for that scenario step.
10. Admin App returns structured validation results to the UI.

This phase's deadline is planned for July 15th, 2026.

## 3. Certification 2.1 Recap

- In Certification 2.1, we established the foundation for Bruno integration with Admin App through a proof of concept (POC) that demonstrated the feasibility of running Bruno CLI commands from the API and returning results to the frontend.
- We also defined a contract for publishing Bruno artifacts from the `certification-testing` repository and consuming them in Admin App.
- To demonstrate the end-to-end flow, we implemented mockups for the frontend certification module and scenario execution pages, with static data and no real API integration.

> There was a change in scope from the original Certification 2.1 brief, it was changed from a basic implementation of the certification workflow with real API integration, to a more limited POC approach focused on validating the technical feasibility of Bruno integration, artifact consumption, and limited frontend mockups without real API integration. This change was made to mitigate risks and focus on validating the core technical challenges before investing in a full implementation. All remaining implementation work and API integration was deferred to Certification 2.2 (Phase 2) to ensure a more focused and achievable scope for the next phase.

## 4. Certification 2.2 Scope Boundaries

### In Scope

- Expose and integrate a scenarios catalog API.
  - The Backend will defined the required database schema and configuration for the scenarios catalog and status managment.
  - The API will return the list of (allowlisted) scenarios that can be executed.
  - The API will return the required parameters for each scenario to the frontend.
  - The API will return the current status of the scenario execution (e.g. pending, failed, completed).
  - The frontend will render the scenario list and details based on the API response.
- Expose and integrate a scenario validation API.
  - The API will validate the scenario path and parameters against the allowlist before execution.
  - The API will execute the `Bruno CLI` command for the selected scenario step.
  - The API will registry certification approval process.
  - The API will return a structured and simplified validation result to the frontend.
  - The frontend will send the required credentials and parameters to the validation API and display the results in a user-friendly format.
- Sandbox provisioning.
  - Admin App will provide the functionality for the `App` (sandbox) and `Credentials` creation.
  - Admin App will cache the created credentials for the validation process.
- Support for Data Standard 5.
  - The certification scenarios and Bruno scripts will be updated to support Data Standard 5 in addition to Data Standard 4, allowing vendors to choose which version they want to validate against.
- Explore AI guided remediation and support for Certification 2.3.
  - In Phase 2, we will explore the feasibility and potential approaches for integrating AI-guided remediation and support into the certification experience. This could include features like AI-generated suggestions for fixing validation errors, interactive troubleshooting guides, or AI-powered documentation search. However, the actual implementation of AI features will be deferred to Phase 3 to ensure we can focus on delivering the core certification execution experience in Phase 2.
- Investigate how to implement DID validation in the certification workflow and explore potential approaches for integrating it into the Admin App. This will be an important step towards supporting decentralized identity in the certification process, but the actual implementation will be deferred to Phase 3 to allow for more research and planning.

### Out of Scope (Deferred to Certification 2.3)

- Decentralized ID (DID) validation ([1EdTech Uniform Id](https://www.1edtech.org/standards/uniform-id-framework)).
  - Admin App will validate the DID provided by the user and extract the required credentials for the validation process.
  - Verifiable Credential (VC) issuance.
- Artificial Intelligence (AI) guided remediation and support.

### Comparison: Total Scope vs Phase 2 Scope

| Certification 2026 - Capability / Step            | Current Status | Phase 1       | Phase 2 (This Brief)           | Phase 3      |
| ---                                               | ---            | ---           | ---                            | ---          |
| Verify Integration feasibility                    | Done           | In Scope      |                                |              |
| List Certification scenarios                      | In progress    | Reduced scope | In scope                       |              |
| Trigger certification tests                       | In progress    | Reduced scope | In scope                       |              |
| Execute test suite (`Bruno CLI`)                  | Pending        | Out of scope  | In Scope                       |              |
| Registry certification statuses                   | Pending        | Out of scope  | In scope                       |              |
| Data Standard 5 support                           | Pending        | Out of scope  | In scope                       |              |
| Sandbox and App creation                          | Pending        | Out of scope  | In scope                       |              |
| DID validation                                    | Pending        | Out of scope  | Reduced scope (investigation)  | In scope     |
| AI guided remediation and support                 | Pending        | Out of scope  | Reduced scope (investigation)  | In scope     |

> The scope could change based on the team capacity and priorities, but the current plan is to focus on the core certification execution workflow in Phase 2, while deferring the more complex and integrated features (like DID validation and AI support) to Phase 3 to ensure a successful delivery of the main certification experience in Phase 2.

__Summary:__

- Phase 2 focuses on delivering the core certification execution experience with real API integration, while deferring the more complex features to Phase 3.
- The main goal is to enable vendors to run certification checks within Admin App with a user-friendly interface and structured results, while ensuring a secure and maintainable integration with Bruno CLI.

## 5. Architecture Overview

```mermaid
---
config:
  theme: base
---
flowchart 
    subgraph ArtifactSource["GitHub: certification-testing"]
        ART>"Versioned Bruno ZIP"]
    end

    subgraph BRUNO["Bruno"]
        TMP["Temporary SIS workspace"]
    end

    subgraph AdminApp["Admin App"]
        FE["Frontend"]
        API["API"]
        BRUNO
    end

    subgraph Vendor["Vendor"]
        APP["Vendor App (external)"]
        ODS-API["ODS API"]
        ODS-DB["ODS DB"]
    end

    subgraph Data["Admin API"]
        ADMINAPI-DB["Admin DB"]
        CERT>"Certification schema (scenarios + status)"]
        ADMINAPI["Admin API"]
    end

    FE <-- HTTPS --> API
    FE <-- HTTPS --> ADMINAPI
    ADMINAPI <-- get/update certification scenarios --> ADMINAPI-DB
    ADMINAPI -- create instance--> ODS-DB
    ADMINAPI-DB ==>  CERT
    ART -- download artifact --> API
    API -- checksum and install artifact --> TMP
    API <-- run scenario --> TMP
    APP -- send data --> ODS-API
    TMP <-- validate data --> ODS-API
    ODS-API <-- query data --> ODS-DB

    API@{ shape: diam}
    ADMINAPI@{ shape: diam}
    ODS-API@{ shape: diam}
    ODS-DB@{ shape: cyl}
    ADMINAPI-DB@{ shape: cyl}
```

__Description:__

- Artifact: Admin App consumes a versioned Bruno ZIP (release tag or commit). The API fetches artifact metadata and verifies SHA‑256 both against published metadata and `CERT_BRUNO_SRC_CHECKSUM` before use.
- Runtime: The Bruno runtime is initialized inside the API container (extract ZIP and run `npm ci` on import). A persisted reference (`.ref`) lets the API skip re-import when the ref matches.
- Scenarios catalog: The `Certification` schema is the source of truth for allowlisted scenarios, scenario metadata (parameters, descriptions, enabled flag) and execution status; the API reads scenarios for `/api/certification/scenarios` and writes run status after execution.
- Execution: For each validation request the API creates a temporary working copy, injects parameters and per‑run credentials (via Bruno `--env-var`), runs a single scenario step, parses the Bruno JSON reporter, and removes the temporary copy.
- Credentials & concurrency: Users may opt to cache encrypted sandbox credentials or provide custom credentials per run; the API passes credentials via `--env-var` to support concurrent runs. Validation requests are queued and executed with a configurable concurrency limit.
- Logs: The API records run metadata (`artifactVersion`, `commitSha`, `scenarioPath`, `parameters`, timestamps, duration, exitCode)
- Only allowlisted scenarios and validated payloads are executed and checksum/config mismatches block (or warn per `CERT_BRUNO_ON_DOWNLOAD_ERROR`).

## 6. Certification Lifecycle

```mermaid
flowchart TD
  Startup[App startup]
  Startup --> Download[Download pinned Bruno artifact + verify checksum]
  Download --> |secure|Prepare[Extract artifact + install dependencies]
  Download -->|insecure| Block["Block execution (error/warn)"]
  Prepare -->|error| Block["Block execution (error/warn)"]
  Prepare -->|success| Extract[Bruno runtime ready]

  User[User signs in & selects Environment/Sandbox]
  User --> Open[Open Certification module]
  Open --> List[API reads scenarios list from Database]
  List --> FE["Frontend shows (allowlisted) scenarios"]

  FE --> Submit[User submits credentials, scenario, parameters]
  Submit --> Queue[API enqueue -> Bruno validation request]
  Queue --> Worker[API dequeue -> prepare temporary scenario workspace + params]
  Worker --> Run["Bruno run scenario step (using --env-var for credentials)"]
  Run --> Parse[API parses Bruno JSON report]
  Parse --> Update["API updates scenario status (error/success) in the Database"]
  Update --> Notify[Return simplified result to FE]
  Run --> Cleanup[API deletes temporary scenario workspace]
```

__Description:__

- Startup: On application start the API prepares a containerized runtime workspace by downloading the pinned Bruno artifact, verifying SHA‑256, extracting it, and installing runtime dependencies. Checksum or config issues block execution (or emit warnings per configuration).
- Scenarios catalog: The API reads allowlisted scenarios and parameter metadata from the `Certification` schema and exposes them to the frontend via `/api/certification/scenarios`.
- Run lifecycle: When a user submits a validation request the API creates a run record (pending) in the `Certification` schema, enqueues the request, and the worker prepares a per‑run temporary workspace where parameters and per‑run credentials are provided to Bruno via `--env-var`.
- Execution & persistency: After Bruno completes, the API parses the JSON reporter, updates the run record with status and traceability metadata (`artifactVersion`, `commitSha`, `scenarioPath`, `parameters`, timestamps, duration, exitCode`), and stores operator logs for debugging; the frontend receives a sanitized, structured result.
- Concurrency & credentials: Requests are queued and processed with a configurable concurrency limit; credentials may be cached (encrypted, opt‑in) or provided per run — always passed to Bruno as environment variables to avoid mutating shared runtime state.
- Cleanup & retention: Temporary working copies are removed after each run; retained artifacts (run metadata, operator logs) follow a configurable retention policy and are accessible to operators only.

## 7. Phase 2 Certification Workflow

```mermaid
sequenceDiagram
  autonumber
  actor User as Vendor User
  participant FE as Admin App FE
  participant API as Admin App API
  participant Runtime as Bruno Runtime (temp workspace)
  participant AdminAPI as Admin API
  participant ODS as Vendor ODS API
  
  API->>Runtime: Download artifact and verify checksum
  
  User->>FE: Create new ODS Instance
  FE->>AdminAPI: POST /api/instance-manager/new
  AdminAPI-->>FE: Instance details and credentials
  User->>FE: Open Certification Process and submit credentials
  FE->>AdminAPI: GET /api/certification/scenarios
  AdminAPI-->>FE: Scenarios lists and process status
  User->>FE: submit scenario step and parameters

  FE->>API: POST /api/certification/validate
  API->>API: Validate allowlist and request payload
  alt Invalid request
    API-->>FE: 4xx error with validation details
  else Valid request
    API->>API: [Enqueue/Dequeue] Validation request
    API->>Runtime: Build scenario workspace with parameters
    Runtime->>ODS: Execute scenario step via Bruno CLI
    ODS-->>Runtime: API response payloads
    Runtime-->>API: Bruno JSON reporter output
    API->>API: Parse to simplified response
    API->>AdminAPI: Register scenario status (error/success)
    API-->>FE: Scenario results
    FE-->>User: Display validation outcome and guidance
  end
```

__Description:__

- The API is the control point for validation and safety.
- Bruno runtime is temporary and scoped to execution.
- User sees structured results, not raw CLI logs.

## 8. Certification Database Schema

In order to keep track of the certification scenarios, their parameters, and the execution status, we will define a new database schema in the Admin API database. There are two proposed designs for the database schema: a catalog-backed design that includes tables for the scenarios catalog and parameters, and a catalog-free design that focuses on runtime tracking of certification processes, scenarios, and steps without static catalog tables. The final decision on which design to implement will be based on factors such as complexity, maintainability, and how well it supports the required features for the certification process.

### Entity Relationship Diagram

```mermaid
erDiagram
    AreaCatalog {
        int AreaId PK
        string Name
        int Order
        boolean IsEnabled
    }

    ScenarioCatalog {
        int ScenarioId PK
        int AreaId FK
        string Name
        int Order
        boolean IsEnabled
    }

    StepCatalog {
        int StepId PK
        int ScenarioId FK
        string StepName
        string StepType "CREATE | UPDATE | DELETE"
        int Order
        boolean IsEnabled
    }

    StepParameterCatalog {
        int ParameterId PK
        int StepId FK
        string Name
        string Description
    }

    ODS {
        int OdsId PK
    }

    CertificationProcess {
        int CertificationProcessId PK
        string DataStandardVersion "v4 | v5"
        string Status "pending | inprogress | failed | completed"
        datetime CreatedAt
        datetime UpdatedAt
    }

    ODS_X_CertificationProcess {
        int OdsId FK
        int CertificationProcessId FK
        string ArtifactVersion
        string Status "inprogress | failed | completed"
    }

    CertificationProcess_X_Scenario {
        int CertificationProcessId FK
        int ScenarioId FK
        string Status "inprogress | failed | completed"
    }

    Scenario_X_Step {
        int StepRunId PK
        int CertificationProcessId FK
        int ScenarioId FK
        int StepId FK
        string Status "pending | failed | success"
        datetime RunAt
    }

    ScenarioStepError {
        int ErrorId PK
        int StepRunId FK
        string Description
        string Validation
    }

    AreaCatalog ||--o{ ScenarioCatalog : "has"
    ScenarioCatalog ||--o{ StepCatalog : "has"
    StepCatalog ||--o{ StepParameterCatalog : "requires"
    ODS ||--o{ ODS_X_CertificationProcess : "participates in"
    CertificationProcess ||--o{ ODS_X_CertificationProcess : "for"
    CertificationProcess ||--o{ CertificationProcess_X_Scenario : "includes"
    ScenarioCatalog ||--o{ CertificationProcess_X_Scenario : "tracked in"
    CertificationProcess_X_Scenario ||--o{ Scenario_X_Step : "has steps"
    StepCatalog ||--o{ Scenario_X_Step : "executed as"
    Scenario_X_Step ||--o{ ScenarioStepError : "logs"
```

### Entity Relationship Diagram — Catalog-free (runtime tracking only)

Optional simplified schema focused on runtime tracking of certification processes, scenarios, and steps, without the static catalog tables:

```mermaid
erDiagram
    ODS {
        int OdsId PK
    }

    CertificationProcess {
        int CertificationProcessId PK
        int OdsId FK
        string DataStandardVersion "v4 | v5"
        string ArtifactVersion
        string Status "pending | inprogress | failed | completed"
        datetime CreatedAt
        datetime UpdatedAt
    }

    CertificationScenarioRun {
        int ScenarioRunId PK
        int CertificationProcessId FK
        string AreaName
        string ScenarioName
        string Status "inprogress | failed | completed"
    }

    CertificationStepRun {
        int StepRunId PK
        int ScenarioRunId FK
        string StepName
        string StepType "CREATE | UPDATE | DELETE"
        int StepOrder
        string Status "pending | failed | success"
        datetime RunAt
    }

    ScenarioStepError {
        int ErrorId PK
        int StepRunId FK
        string Description
        string Validation
    }

    ODS ||--o{ CertificationProcess : "has"
    CertificationProcess ||--o{ CertificationScenarioRun : "includes"
    CertificationScenarioRun ||--o{ CertificationStepRun : "has steps"
    CertificationStepRun ||--o{ ScenarioStepError : "logs"
```

### What you gain vs. the catalog-backed design

|                                           | Catalog-backed                | Catalog-free                                    |
| ---                                       | ---                           | ---                                             |
| Tables                                    | 9                             | 5                                               |
| Self-contained audit record               | No (FKs to catalog required)  | Yes — each run row owns its identity            |
| Allowlist enforcement at DB layer         | Yes (IsEnabled)               | No — must be enforced in application layer      |
| Parameter definitions persisted           | Yes (StepParameterCatalog)    | No — parameters live only in the Bruno artifact |
| Renameable scenarios without history loss | No                            | Yes — string snapshots are immutable            |

### Original JSON Schema for `certification-scenarios.json`

The Original design included a JSON schema that was transfered to the database schema design. The API will read the scenarios from the database and expose them to the frontend, instead of reading from a JSON file. The JSON schema is provided here for reference:

```json
{
  [
    {
      "scenariosVersion": "v4",
      "scenariosGroup": "MasterSchedule",
      "scenariosName": "BellSchedules",
      "Status": "inprogress | failed | completed",
      "Steps": [
        {
          "scenarioStep": "01 - Check BellSchedule is valid",
          "scenarioType": "CREATE", // CREATE | UPDATE | DELETE
          "Status": "failed | success",
          "parameters": [
            {
              "name": "schoolId",
              "description": "School id"
            },
            {
              "name": "bellScheduleName",
              "description": "BellSchedule name"
            }
          ]
        },
        {
          "scenarioStep": "02 - Check BellSchedule is deleted",
          "scenarioType": "DELETE", // CREATE | UPDATE | DELETE
          "Status": "failed | success",
          "parameters": [
            {
              "name": "bellScheduleUniqueId",
              "description": "BellSchedule UniqueId"
            }
          ]
        }
      ]
    }
  ]
}
```

## 9. Security Gaps and Recommendations

This section documents security concerns identified during design and early implementation review of Phase 2, mapped against OWASP Top 10 and general secure-systems principles. Each item includes a risk rating, description, and concrete recommendation.

---

### 9.1 OS Command Injection via `scenarioPath` and Shell Execution

__Risk: CRITICAL__ | OWASP A03 – Injection

The POC `runBruno()` method constructs a shell command using a user-supplied `scenarioPath` string and invokes `spawnSync` with `shell: true`:

```ts
// From POC (certification.service.ts)
const cmd = `${localBru} run "${target}" --env ${env}`;
spawnSync(fallback, { shell: true, ... });
```

A `scenarioPath` value such as `v4/Group/Step"; rm -rf /;#` would execute arbitrary OS commands inside the container. The `env` parameter is equally unvalidated.

__Recommendations:__

- Never use `shell: true` when any part of the command includes external input; always use the array-argument form of `spawnSync`/`spawn`.
- Pass credentials exclusively as isolated `--env-var` arguments (one flag per variable), not as an interpolated env-string.
- Enforce a strict, server-side allowlist for `scenarioPath` validated against the DB catalog __before__ any process is spawned. Reject immediately if the path is not in the allowlist.

```ts
// Secure pattern – no shell, no string interpolation
spawnSync(localBru, ['run', scenarioPath, '--env', 'ODS', '--env-var', `edFiClientId=${clientId}`], {
  shell: false, // explicit
  cwd,
  timeout: 60_000,
});
```

---

### 9.2 Path Traversal in Scenario Workspace Preparation

__Risk: HIGH__ | OWASP A01 – Broken Access Control

`prepareScenario()` resolves the scenario source directory by joining user-supplied input directly:

```ts
const scenarioSrc = path.join(this.runtimeRoot, this.collectionRootName, scenarioPath);
```

A value of `../../../../etc/passwd` would escape the collection root entirely.

__Recommendations:__

- After resolving the full path with `path.resolve()`, assert it starts with the expected root prefix before any file I/O:

```ts
const resolved = path.resolve(this.runtimeRoot, this.collectionRootName, scenarioPath);
if (!resolved.startsWith(path.resolve(this.runtimeRoot, this.collectionRootName) + path.sep)) {
  throw new ForbiddenException('Invalid scenario path');
}
```

- This check must also apply to temporary working copy destinations.

---

### 9.3 Zip Slip during Artifact Extraction

__Risk: HIGH__ | OWASP A08 – Software and Data Integrity Failures

`extractArtifact()` calls `zip.extractAllTo(tmpDir, true)`. Older versions of `adm-zip` do not validate ZIP entry paths before extraction, so a crafted ZIP whose entries contain `../../../` segments can write files outside `tmpDir` — including into the application source tree or OS paths.

__Recommendations:__

- After extraction validate every resolved entry path starts with the canonical `tmpDir`:

```ts
const canonicalTmp = fs.realpathSync(tmpDir);
zip.getEntries().forEach(entry => {
  const entryPath = path.resolve(tmpDir, entry.entryName);
  if (!entryPath.startsWith(canonicalTmp + path.sep)) {
    throw new Error(`Zip Slip detected: ${entry.entryName}`);
  }
});
zip.extractAllTo(tmpDir, true);
```

- Pin `adm-zip` to a known-good version and monitor for upstream advisories.

---

### 9.4 Credential Exposure via Process List and Disk

__Risk: HIGH__ | OWASP A02 – Cryptographic Failures

Two exposure vectors exist for ODS API credentials:

1. __Process list__: On Linux, process arguments (including `--env-var clientSecret=…`) are briefly visible in `/proc/<pid>/cmdline` and `ps aux`.
2. __Disk artifacts__: The commented-out POC writes `last-command.txt` and `last-output.txt` to `this.runtimeRoot`. If credentials appear in Bruno's JSON output or in the command string, they are persisted in plaintext.

__Recommendations:__

- Pass credentials through a per-run environment variable map via `spawnSync`'s `env` option (not CLI arguments) so they are not visible in the process list:

```ts
spawnSync(localBru, ['run', scenarioPath, '--env', 'ODS'], {
  shell: false,
  env: { ...minimalEnv, EDFI_CLIENT_ID: clientId, EDFI_CLIENT_SECRET: clientSecret },
});
```

- Remove the `last-command.txt` / `last-output.txt` debug files entirely from production paths; gate debug output behind a `LOG_LEVEL=debug` environment flag.
- Ensure Bruno JSON reporter output is scrubbed of credential values before storing or returning it to the frontend.

---

### 9.5 Bypassing Integrity Enforcement via `onDownloadError: 'warning'`

__Risk: HIGH__ | OWASP A08 – Software and Data Integrity Failures

When `CERT_BRUNO_ON_DOWNLOAD_ERROR=warning`, the service continues execution even when the artifact cannot be downloaded or its checksum cannot be verified. This means Bruno could run against a stale, corrupted, or tampered artifact.

__Recommendations:__

- Treat the `warning` mode as a __development-only__ opt-in.
- Block all certification execution requests (return `503 Service Unavailable`) when `isRuntimeReady` is `false`, regardless of warning mode.
- Document and enforce this constraint via an environment-level guard in the controller before queuing any run.

---

### 9.6 Broken Access Control – Missing Authorization on Certification Endpoints

__Risk: HIGH__ | OWASP A01 – Broken Access Control

The current controller imports `@Public()` (a temporary POC annotation), and the commented-out run endpoint was marked `@Public()`. Phase 2 must use proper role-based authorization:

- Not every authenticated user should be able to trigger a validation run.
- A run initiated by Vendor A must not be accessible to Vendor B (tenant isolation).
- Operator-level logs must be restricted to admin roles only.

__Recommendations:__

- Replace `@Public()` with `@Authorize(Role.VendorUser)` (or equivalent) on all certification endpoints, as documented in user preferences.
- Scope all database queries for `CertificationProcess`, `CertificationScenarioRun`, and `CertificationStepRun` by the caller's tenant/user identity — never by bare integer ID from the request body.
- Apply `@Authorize(Role.Admin)` on any endpoint that returns raw run logs or traceability metadata.

---

### 9.7 Denial of Service – Unbounded Queue and Execution Timeout

__Risk: MEDIUM__ | OWASP A05 – Security Misconfiguration

The design mentions a configurable concurrency limit and queue, but the current code has no enforced queue depth cap or per-run timeout. A malicious or malfunctioning user could:

- Submit hundreds of concurrent validation requests, exhausting container memory.
- Trigger a Bruno run against a slow ODS API with no timeout, tying up a worker indefinitely.

__Recommendations:__

- Enforce a hard queue depth cap (e.g., 50 pending items) and reject new requests with `429 Too Many Requests` when exceeded.
- Set an absolute execution timeout on `spawnSync` (e.g., `timeout: 120_000` ms) and terminate the child process if it is exceeded.
- Expose queue depth and active worker count metrics for operational monitoring.

---

### 9.8 Sensitive Data Leakage in API Responses

__Risk: MEDIUM__ | OWASP A02 – Cryptographic Failures / OWASP A09 – Security Logging

Bruno's JSON reporter output includes raw HTTP request/response bodies from the ODS API. Returning this output verbatim to the frontend could expose:

- Other tenants' data if ODS API returns related records.
- Internal stack traces or error messages from Vendor ODS implementations.
- Credential echo-back if a Bruno script logs its own environment.

__Recommendations:__

- Parse Bruno's JSON report into a defined `ValidationResult` DTO and only return fields explicitly included in the DTO.
- Never forward Bruno's raw stdout or stderr to the frontend; store it server-side under an operator-only log endpoint.
- Sanitize any error descriptions included in `ScenarioStepError` before persisting them; strip HTTP Authorization headers from stored payloads.

---

### 9.9 Insecure Credential Caching

__Risk: MEDIUM__ | OWASP A02 – Cryptographic Failures

Phase 2 allows opt-in caching of sandbox credentials. The encryption mechanism, key derivation, and storage backend are not yet specified.

__Recommendations:__

- Use AES-256-GCM with a unique random IV per record; store IV alongside the ciphertext.
- Derive the encryption key from the application secret using HKDF — do not use the raw secret directly.
- Store cached credentials with a short TTL (e.g., 8 hours) and bind them to the session or user identity — never to a shared store accessible across users.
- Provide a clear UI affordance for the user to revoke cached credentials at any time.

---

### 9.10 Weak Input Validation on Scenario Parameters

__Risk: MEDIUM__ | OWASP A03 – Injection

The `RunDto` defines `params` as `Record<string, any>`. Without schema validation, a caller could inject unexpected types (arrays, objects, deeply nested structures) that break placeholder substitution or cause runtime errors in the Bruno script.

__Recommendations:__

- Replace `any` with a strict value type: `Record<string, string>`.
- Validate the parameter set against the catalog definition stored in `StepParameterCatalog` before processing — reject requests with undeclared parameter keys.
- Apply class-validator decorators and the NestJS `ValidationPipe` on all certification DTOs.

---

### Summary Table

| #   | Gap                                        | Severity | OWASP Category               |
| --- | ------------------------------------------ | -------- | ---------------------------- |
| 9.1 | OS command injection via shell execution   | Critical | A03 – Injection              |
| 9.2 | Path traversal in scenario workspace       | High     | A01 – Broken Access Control  |
| 9.3 | Zip Slip during artifact extraction        | High     | A08 – Integrity Failures     |
| 9.4 | Credential exposure via process/disk       | High     | A02 – Cryptographic Failures |
| 9.5 | Integrity bypass via warning mode          | High     | A08 – Integrity Failures     |
| 9.6 | Missing authorization / tenant isolation   | High     | A01 – Broken Access Control  |
| 9.7 | Unbounded queue and missing timeout        | Medium   | A05 – Misconfiguration       |
| 9.8 | Sensitive data in API responses            | Medium   | A02/A09 – Data Exposure      |
| 9.9 | Insecure credential caching                | Medium   | A02 – Cryptographic Failures |
| 9.10| Weak parameter input validation            | Medium   | A03 – Injection              |

## 10. Additional or Future Nice-to-Have Features

- Progress bar
  - The progress bar is based on the number of steps defined in the Bruno script for the selected scenario.
  - As each step is completed, the progress bar is updated accordingly.
  - This provides users with a visual indication of the certification process and its completion status.
- Scenarios order
  - The order of scenarios is determined by the `order` field in the `CertificationScenario` table.
  - Scenarios with lower `order` values are displayed before those with higher values.
  - This allows for flexible ordering of scenarios based on their importance or logical sequence.
- Think about a dedicated Certification API service
  - Responsibilities and interactions with Admin App
  - Deployment and scaling considerations
- Allow the user to select a custom collection for certification testing
  - UI design for collection selection
  - Validation of selected collection

## 11. Delivery Constraints, Risks, and Mitigations

### Constraints

- Team capacity and diluted focus could affect our overall delivery velocity.
- Self-service is a first-order product requirement.
- Bruno scripts are largely static by design.

### Key risks

- High integration complexity across two incompatible repositories (React and Bruno scripts).
- Runtime command execution increases operational and security sensitivity.
- Response normalization from CLI output can be error-prone.
- Bruno scripts are sensitive to version and structural shifts; small modifications can easily lead to breaking changes.
- The `certification-testing` solution only supports DataStandard `v4`. A modernization to `v5` is required to support both versions.

### Mitigations

- Independent runtime workspace inside Admin App for Bruno scripts.
- Certification scenario validations are delegated to Bruno CLI to reduce breaking-changes risks.
- Keep `certification-testing` as source of truth and consume versioned artifacts.
- Enforce allowlist and checksum validation before execution.
- Limit execution to single scenario-step in Phase 1.
- Log traceability metadata for supportability and audits.

## 12. Proposed Requirements, Timeline and Milestones

### Requirements

#### Functional Requirements

__FR-1 – Scenarios Catalog API:__

- The system shall expose `GET /api/certification/scenarios` returning the ordered, allowlisted list of certification scenarios, their required parameters, and current execution status scoped to the authenticated user's tenant.
- The system shall read scenarios from the `Certification` database schema (see §8 for catalog-backed vs. catalog-free decision).

__FR-2 – Scenario Validation API:__

- The system shall expose `POST /api/certification/validate` accepting a scenario path, credentials, and parameters.
- The system shall validate `scenarioPath` against a server-side allowlist before any process is spawned.
- The system shall execute a single Bruno CLI scenario step per validation request.
- The system shall return a sanitized `ValidationResult` DTO to the frontend; raw Bruno output shall not be forwarded.
- The system shall record a run entry with status and traceability metadata (`artifactVersion`, `commitSha`, `scenarioPath`, `parameters`, timestamps, duration, `exitCode`) in the database.

__FR-3 – Bruno Runtime Lifecycle:__

- At application startup the system shall download the pinned Bruno artifact, verify its SHA-256 checksum, extract it, and install runtime dependencies.
- The system shall block all certification execution requests when `isRuntimeReady` is `false`, regardless of `CERT_BRUNO_ON_DOWNLOAD_ERROR` mode.

__FR-4 – Sandbox Provisioning:__

- The system shall allow users to create a sandbox Application and retrieve Credentials within Admin App.
- The system shall support opt-in caching of sandbox credentials using AES-256-GCM with an HKDF-derived key, a unique random IV per record, and an 8-hour TTL bound to the user's session identity.
- The frontend shall provide a clear affordance for the user to revoke cached credentials at any time.

__FR-5 – Data Standard 5 Support:__

- The `certification-testing` artifact shall be updated to support Data Standard 5 scenarios alongside the existing Data Standard 4 collection.
- Users shall be able to select between Data Standard v4 and v5 when opening a certification process.

__FR-6 – Certification Status Registry:__

- The system shall track certification process, scenario run, and step run statuses in the database.
- Statuses shall reflect: `pending`, `inprogress`, `failed`, `completed` / `success` as defined per entity in §8.

__FR-7 – Investigation: AI-Guided Remediation:__ _(research only — implementation deferred to 2.3)_

- The team shall document feasibility findings and potential approaches for AI-guided remediation to inform Certification 2.3 planning.

__FR-8 – Investigation: DID Validation:__ _(research only — implementation deferred to 2.3)_

- The team shall document feasibility findings for DID validation integration to inform Certification 2.3 planning.

---

#### Non-Functional Requirements

__NFR-1 – Security (OWASP):__

- `spawnSync` / `spawn` shall never use `shell: true` when any user-supplied input is present; the array-argument form is mandatory (OWASP A03).
- All resolved scenario paths shall be prefix-validated against the collection root before any file I/O; path traversal attempts shall throw `ForbiddenException` (OWASP A01).
- ZIP entry paths shall be validated against `canonicalTmp` before extraction to prevent Zip Slip (OWASP A08).
- Credentials shall be passed to Bruno exclusively via `spawnSync`'s `env` option — never as CLI arguments (OWASP A02).
- All certification endpoints shall use `@Authorize(Role.VendorUser)`; any endpoint exposing raw run logs or traceability metadata shall use `@Authorize(Role.Admin)` (OWASP A01).
- All database queries shall be scoped by the caller's tenant/user identity; bare integer IDs from request bodies shall never serve as the sole access guard.

__NFR-2 – Input Validation:__

- The `params` field in `RunDto` shall be typed `Record<string, string>`; requests with undeclared parameter keys shall be rejected (OWASP A03).
- All certification DTOs shall apply class-validator decorators and the NestJS `ValidationPipe`.

__NFR-3 – Reliability and Capacity:__

- The execution queue shall enforce a hard depth cap (e.g., 50 pending items); excess requests shall return `429 Too Many Requests`.
- Each Bruno run shall have an absolute execution timeout (e.g., 120 seconds); the child process shall be terminated if the timeout is exceeded.

__NFR-4 – Data Privacy:__

- Bruno raw stdout and stderr shall never be returned to the frontend; stored operator logs shall be accessible only to admin roles.
- Bruno JSON reporter output shall be scrubbed of credential values before persistence or inclusion in any API response.
- HTTP Authorization header values shall be stripped from stored `ScenarioStepError` payloads.

---

### Timeline and Milestones

> __Note on capacity:__ Other projects will run in parallel throughout Phase 2. Milestone dates are intentionally loose — they represent target windows, not hard sprint boundaries. Overlap between milestones is expected and planned for.

__Overall window:__ April 2026 – July 15, 2026 (~15 weeks)

| Milestone | Description | Target Window |
| --- | --- | --- |
| __M1__ – Foundation & Security | DB schema migration, security hardening (NFR-1 to NFR-4), Bruno startup lifecycle, authorization hardening | April 2026 |
| __M2__ – Backend Core | Scenarios catalog API, validation API with Bruno CLI execution, bounded queue with timeouts, sanitized response DTOs, run record persistence | May 2026 |
| __M3__ – Frontend Integration | Real API integration for scenario list and step execution, results display, sandbox provisioning UI | Late May – June 2026 |
| __M4__ – DS5 & Credential Caching | Data Standard 5 artifact update, v4/v5 selector, AES-256-GCM credential caching with revoke | June 2026 |
| __M5__ – Stabilization & Investigations | E2E tests, security review, AI remediation research write-up, DID validation research write-up, documentation | Late June – July 15, 2026 |

---

#### Milestone Detail

__M1 – Foundation & Security__ _(Target: April 2026)_

- [ ] Decide on DB schema design: catalog-backed (9 tables) vs. catalog-free (5 tables) — see §8.
- [ ] Generate and apply TypeORM migration for the chosen schema.
- [ ] Fix all Critical and High security gaps from §9 (issues 9.1 through 9.6).
- [ ] Implement Bruno artifact startup: download, SHA-256 verification, extraction, `npm ci`.
- [ ] Block all certification execution requests when `isRuntimeReady` is `false` (§9.5).
- [ ] Replace `@Public()` with `@Authorize(Role.VendorUser)` on all certification endpoints.
- [ ] Scope all certification DB queries by tenant/user identity.

__M2 – Backend Core__ _(Target: May 2026)_

- [ ] Implement `GET /api/certification/scenarios` (real DB data, allowlist enforced, tenant-scoped).
- [ ] Implement `POST /api/certification/validate` with `spawnSync(..., { shell: false })`.
- [ ] Implement execution queue with bounded depth cap and per-run absolute timeout.
- [ ] Implement `ValidationResult` DTO serialization — no raw stdout/stderr exposed to FE.
- [ ] Persist run records with full traceability metadata after each execution.
- [ ] Address Medium security gaps from §9 (issues 9.7 through 9.10).

__M3 – Frontend Integration__ _(Target: Late May – June 2026)_

- [ ] Connect scenarios list page to `GET /api/certification/scenarios` (replace static mock data).
- [ ] Connect scenario step submission form to `POST /api/certification/validate`.
- [ ] Render structured validation results, per-step status, and error guidance.
- [ ] Implement sandbox provisioning UI (App creation, Credentials retrieval).
- [ ] Display cached credential status with a visible revoke option.

__M4 – DS5 & Credential Caching__ _(Target: June 2026)_

- [ ] Update `certification-testing` repository to include Data Standard 5 Bruno collections (separate repository work — coordinate with `certification-testing` maintainers).
- [ ] Add Data Standard version selector (v4 / v5) to the frontend certification flow.
- [ ] Implement AES-256-GCM credential caching with HKDF-derived key, per-record random IV, and 8-hour TTL.
- [ ] Bind cached credentials to session/user identity; reject cross-user access.

__M5 – Stabilization & Investigations__ _(Target: Late June – July 15, 2026)_

- [ ] E2E test coverage for the core certification flow (sandbox creation → scenario selection → step execution → results display).
- [ ] Security review pass against the §9 gap table; confirm all items addressed or formally accepted.
- [ ] AI-guided remediation feasibility investigation write-up (for Certification 2.3 planning).
- [ ] DID validation feasibility investigation write-up (for Certification 2.3 planning).
- [ ] Documentation and readiness review before the July 15 deadline.

## 13. Open Questions

- Should we let the user provide a custom collection for certification testing, or should we enforce using the versioned artifact from `certification-testing`?
  - Allowing custom collections could provide more flexibility but also introduces risks around compatibility and security. We need to weigh the benefits of flexibility against the potential risks and implementation complexity.
- How should we handle caching of recently created credentials for the validation process?
  - Caching credentials could improve user experience by reducing the need to re-enter credentials for each validation run, but it also introduces security considerations around how credentials are stored and protected. We need to explore secure caching mechanisms and determine the appropriate retention policy for cached credentials.
- Should we let the user to discard a certification process and start over?
  - If so, how should this be reflected in the certification status registry and the database schema? Allowing users to discard and restart certification processes could provide a better user experience, but we need to consider how this would impact our tracking of certification statuses and the integrity of our data. We may need to introduce new statuses or flags in our database schema to accommodate this functionality.

## Appendix A - Retained Story Details

### A.1 Context

The [Certification](https://github.com/Ed-Fi-Alliance-OSS/certification-testing) solution uses [Bruno](https://docs.usebruno.com/) collections to validate ODS API behavior.

Admin App will provide UI-guided execution so users can run scenario validations with required credentials and parameters and receive user-friendly result summaries.

### A.2 Certification 2.1 Context

The [Certification 2.1](../phase1/certification-2.1.md) implementation focused on validating the technical feasibility of integrating Bruno CLI execution into Admin App, and consuming artifacts from `certification-testing`. The scope was limited to a proof of concept with mock frontend pages and no real API integration, to mitigate risks and focus on validating the core technical challenges before investing in a full implementation. All remaining implementation work and API integration was deferred to Certification 2.2 (Phase 2) to ensure a more focused and achievable scope for the next phase.

### A.3 Repository Layouts

`certification-testing` (Bruno artifact source):

- `bruno/SIS/environments`
- `bruno/SIS/.env`
- `bruno/SIS/v4/<ScenarioGroups>/<ScenarioNames>/<ScenarioSteps>`

Admin App extension points:

- `packages/api/src/certification` (API implementation)
- `packages/api/certification/bruno` (runtime artifact workspace)
- `packages/fe/src/Pages/Certification` (frontend implementation)

### A.4 Phase 1 Workflow Inputs Already Available

- User logs into Admin App.
- User creates Environment and ODS Instance settings.
- User selects Environment.

## Appendix B - POCs and Feasibility Notes

To overcome the blockers mentioned in the [Delivery Constraints, Risks, and Mitigations](../phase1/certification-2.1.md#9-delivery-constraints-risks-and-mitigations) section, many POCs were conducted to confirm feasibility and integration between `Ed-Fi-AdminApp` and `certification-testing`. It was determined that the connection is viable in two ways: a Bruno Parser and a Bruno Integrator (recommended option).

### B.1 POC 1 (Bruno Parser)

- Converts `.bru` scripts into executable JavaScript.
- Pros: high customization and direct parameterization.
- Cons: tighter coupling to upstream file structure.

### B.2 POC 2 (Bruno Integrator, recommended)

- Uses Bruno CLI with temporary working copies and parameter replacement.
- Pros: lower implementation complexity and better upstream compatibility.
- Cons: less direct execution control, CLI output handling complexity.

### B.3 Related PRs

For implementation details, review:

- [Bruno Parser: Ed-Fi-AdminApp](https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/pull/66)
- [Bruno Integrator: Ed-Fi-AdminApp](https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/pull/68)
- [Bruno Integrator: certification-testing](https://github.com/Ed-Fi-Alliance-OSS/certification-testing/pull/111)

## Appendix C - Certification 2026 sequence workflows

### Vendor Sequence diagram

![Vendor Sequence diagram](../phase1/assets/certification-vendor-sequence.png "Vendor Sequence diagram")

### MSP Sequence diagram

![MSP Sequence diagram](../phase1/assets/certification-msp-sequence.png "MSP Sequence diagram")

### Representative Sequence diagram

![Representative Sequence diagram](../phase1/assets/certificatoin-rep-sequence.png "Representative Sequence diagram")

### FULL Certification Sequence diagram

![Full Certification Sequence diagram](../phase1/assets/certification-sequence-full.png "Full Certification Sequence diagram")
