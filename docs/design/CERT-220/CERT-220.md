# CERT-220 - Investigation of technical requirements for Certification release 2.1

Define the task required to accomplish the Certification release 2.1 also known as Phase 1.

## Context

[Certification](https://github.com/Ed-Fi-Alliance-OSS/certification-testing) is a [Bruno](https://docs.usebruno.com/) solution used to validate our users "ODS API" implementation has the  minimun required to run their business. Currently, the user interacts with the implemented ODS API and an Ed-Fi representative Certify the data was properly added, for that the representative use the Certification Bruno solution to send GET requests and validate the data is correct.

We need to abstract the Certification (Bruno) solution and give AdminAPP the capabilities to run those Bruno scripts (.bru files) from an User Interface (UI), the UI will asks the user to enter the required autentication and tests parameters, then it will execute the request and handle the response to be displayed in a user-friendly format and guide the user on the process.

To achieve this modernization it is required the completition of three phases. This document defines the requirements (tasks) to acomplish [Phase 1](./CERT-220.md#phase-1).

## Sumary

## Index


## Arcquitecture

### certification-testing

The [certification-testing](https://github.com/Ed-Fi-Alliance-OSS/certification-testing) main logic is contained in the `SIS` directory, where the bruno collection resides.

* ...
* bruno
  * SIS
    * environments
    * .env
    * node_modules
    * v4
      * \<ScenariosGroups>
        * \<ScenariosNames>
          * \<ScenariosSteps>

### Ed-Fi-AdminApp

The [Ed-Fi-AdminApp](https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp) is distributed in two main applications (`api` and `fe`). The `api` handles the logic required for the `fe` (frontend) to work. Therefore, the new certification feature will be spread in the two applications as shown bellow:

* ...
* packages
  * api
    * src
      * ...
      * certification (new certification api)
        * bruno (new directory to store `bruno` collections)
  * fe
    * src
      * Pages
        * ...
        * Certification (new certification frontend)

## Phase 1

For the Phase 1 AdminAPP will allow the user to interact dirrectly with the `Certification` Bruno solution at very basic level.
In this Phase, AdminAPP has no support for `Instance Management`, it will be added in the Phase 2, therefore,
the user will provide its own `ODS` environment and configure it in the AdminAPP application. Then, the user will be able to start the certification process.

## Notes from the spike

* The `certification-testing` repository remains the source of truth for scenario definitions, and no critical modifications will be made to that repository.

### Phase 1 certification workflow

#### Currently developed

* User will login into the AdminApp
* User will create a new `Environment` and its `ODS Instance` configuration
  * __Required Data:__
    * Environment Name
    * ODS API URL
    * Admin API URL  
    * Tenant Name (if multitenant)
    * ODS Database Name
* User will grant `Owership` of the just created `Environment` as an `ODS` resource type to the corresponding `Team`
* User will select the correspoding `Team` from the dropdown
* User will select the desired tenant (if multitenant enabled) from the Environments list

#### Certification 2.1 workflow

* __On startup__ AdminAPP will create a local and termporary copy of `certification-testing`.
* User will access the new `Certification` feature.
* AdminAPP will display the list of certification scenarios to validate.
* User will select any scenario.
* AdminAPP will ask the user to enter the required scenario parameters.
* User will input the correspoding values.
* AdminAPP will update the scenario script (.bru) to use the new parameters values.
* AdminAPP will execute the requests using Bruno scripts (.bru).
* AdminAPP will handle the response and displayed to guide the user based on errors (if any).

### Certification 2.1 User Stories

* Phase 1 must stay reduced in scope to fit `1.5 sprints`.

___

#### CERTIFICATION - Export Bruno artifacts

__Description:__

In the `certification-testing` repository it is required to export the content in the [bruno](https://github.com/Ed-Fi-Alliance-OSS/certification-testing/tree/main/bruno) folder as an artifact that AdminAPP can import in [ADMIN APP - API - Import Bruno artifacts](./CERT-220.md#admin-app---api---import-bruno-artifacts) story.

__Considerations:__

* __Option A - GitHub Release ZIP artifact (recommended)__: Simple distribution model with versioned tags/releases, easy download contract, and straightforward checksum validation.
* __Option B - Azure Artifacts/NuGet package__: Enterprise-ready distribution/governance option, but requires NuGet packaging conventions and feed management overhead.
* __Option C - npm package (content bundle)__: Works well with Node tooling and semver, but requires package publishing and careful handling of non-code artifact structure.
* __Option D - Local folder copy from sibling repo__: Simple for local development, but not deterministic across machines/environments and harder to audit in CI/CD.
* __Option E - Dedicated Certification Runner API__: Strongest isolation and long-term security boundary, but adds service deployment, auth, monitoring, and contract-management overhead.

__Why Option A is the best fit for Phase 1:__

* For the sake of Phase 1, we keep implementation simple by using a versioned artifact download at startup (for example, GitHub Release ZIP artifact).
* It keeps implementation close to the current POC path while removing local-path coupling.
* It enables source pinning and artifact integrity checks required by the Phase 1 security gate.
* It avoids introducing a new production service before core workflow validation is complete.
* More advanced options (for example, __Option E__ dedicated runner API, __Option B__ NuGet packaging model changes) will be considered in future releases.

__Acceptance Criteria:__

* The `certification-testing` CI pipeline publishes a versioned artifact for the `bruno` workspace on merge to `main` and on release tags.
* The published artifact includes the `bruno` content required by AdminAPP (`SIS`, `package.json`, `package-lock.json`, `scripts`, and required config files), and excludes local-only folders (`node_modules`, local cache files).
* The artifact name and version are deterministic and traceable to source (`artifactVersion`, `gitCommitSha`, and `buildTimestamp`).
* The pipeline publishes a checksum file (for example, SHA256) alongside the artifact.
* The artifact location and download contract are documented (feed/release URL pattern, auth method, version format).
* A consumer validation step confirms AdminAPP can download and extract the artifact using only the published contract.

___

#### ADMIN APP - API - Import Bruno artifacts

__Description:__

Based on the [POC 2 - Bruno Integration](./CERT-220.md#poc-2---bruno-integration) update the api `CertificationService` in AdminAPP, and make all the required adjustments:

*Artifact Configuration*: Add config entries for certification source reference:

* `CERT_BRUNO_SRC_REF` (tag/commit)
* `CERT_BRUNO_SRC_CHECKSUM` (optional artifact integrity check)

*Download Artifact:* AdminAPP api will replace the POC local copy approach with a pinned artifact download contract, generated in [CERTIFICATION - Export artifacts](./CERT-220.md#certification---export-bruno-artifacts).
*Integrity validation:* Add checksum verification before extraction; block execution on mismatch.
*Install dependencies:* Then it will install its depedencies (node_modules) from artifact lockfile path (`npm ci` preferred).
*Initialization:* Bruno requires two files to work propperly. Create the following files with placeholders (actual values will overwwriten in [ADMIN APP - API - Scenario Validator Service](./CERT-220.md#admin-app---api---create-a-scenario-validator-service)):

The `SIS/.env` file:

``` txt
EDFI_CLIENT_ID=<replace_with_edfiClientId_parameter>
EDFI_CLIENT_SECRET=<replace_with_edfiClientSecret_parameter>
```

The `SIS/environments/<environment-name>.bru` file:

```json
vars {
  baseUrl: https://localhost/v7-multi-api/tenant1
  resourceBaseUrl: {{baseUrl}}/data/v3
  oauthUrl: {{baseUrl}}/oauth/token
  edFiClientName: {{process.env.EDFI_CLIENT_NAME}}
  edFiClientId: {{process.env.EDFI_CLIENT_ID}}
  edFiClientSecret: {{process.env.EDFI_CLIENT_SECRET}}
}
```

> Alternative: Pass the environment variables directly to the Bruno CLI ([Passing Environment Variables](https://docs.usebruno.com/bru-cli/runCollection#passing-environment-variables))

```code
bru run --env-var EDFI_CLIENT_ID=<client_id> --env-var EDFI_CLIENT_SECRET=<secret>
```

> __References:__
>
> * [environment](https://github.com/Ed-Fi-Alliance-OSS/certification-testing/blob/main/bruno/SIS/environments/api.ed-fi.org.bru)
> * [.env](https://github.com/Ed-Fi-Alliance-OSS/certification-testing/blob/main/bruno/SIS/.env.example)
> * [Using Environments Names](https://docs.usebruno.com/bru-cli/runCollection#using-environments-names)
> * [Secrets Management](https://docs.usebruno.com/secrets-management/dotenv-file)
> *[Using JSON Environment Files](https://docs.usebruno.com/bru-cli/runCollection#using-json-environment-files)

*Ensure functionality*: The `SIS` collection in runtime path is fully functional from the Bruno CLI. This will require either updating the `.env` and `environment` files with valid data or passing the `--env-var` directly.

__Acceptance Criteria:__

* __On startup__ AdminAPP downloads the pinned artifact version generated in  and stores it in a temporary runtime folder.
* AdminAPP validates artifact integrity using the published checksum before extraction; if validation fails, execution is blocked and a clear error is logged.
* AdminAPP extracts the artifact and installs runtime dependencies from the artifact lockfile path (`npm ci` preferred).
* The imported collection is fully funcional from Bruno CLI. To validate, update parameters, `.env` file, and execute `bru run` from the downloaded bruno collection.

__Dependencies:__

* [CERTIFICATION - Export Bruno artifacts](./CERT-220.md#certification---export-bruno-artifacts)

___

#### ADMIN APP - API - Create a Certification Scenarios API

__Description:__

It is required a new API to return the frontend a list of the configured certification scenarios from the `certification-scenarios.json`.

*Expose new API:* Create a new endpoint `/api/certification/scenarios`. The api will receive no parameters, no pagination, no filtering.
*Mapping:* Map the desired certification scenarios configuration in a JSON file `certification-scenarios.json` with the schema below.

```json
  {
    [
      {
        "scenariosVersion": "v4",
        "scenariosGroup": "MasterSchedule",
        "scenariosName": "BellSchedules",
        "scenarioStep": "01 - Check BellSchedule is valid",
        "scenarioType": "CREATE", // CREATE | UPDATE | DELETE
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
        "scenariosVersion": "v4",
        "scenariosGroup": "EducationOrganization",
        "scenariosName": "ClassPeriods",
        "scenarioStep": "01 - Check First ClassPeriod is valid",
        "scenarioType": "CREATE", // CREATE | UPDATE | DELETE
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
        "scenariosVersion": "v4",
        "scenariosGroup": "EducationOrganization",
        "scenariosName": "ClassPeriods",
        "scenarioStep": "03 - Check first ClassPeriod classPeriodName was Updated",
        "scenarioType": "UPDATE", // CREATE | UPDATE | DELETE
        "parameters": [
          {
            "name": "firstClassPeriodUniqueId",
            "description": "First ClassPeriod UniqueId"
          }
        ]
      }
    ]
  }
```

__Acceptance Criteria:__

* AdminAPP will expose a new api for the scenario list.

___

#### ADMIN APP - API - Create a Scenario Validator Service

__Description:__

Based on the [POC 2 - Bruno Integration](./CERT-220.md#poc-2---bruno-integration) update the api `CertificationService` in AdminAPP, and make all the required adjustments:

*Expose new API:* Replace POC endpoint `/api/certification/run`with `/api/certification/validate` to validate certification scenarios. The api will receive the following parameters:

* odsURL (e.g. https://localhost/v7-multi-api/tenant1)
* edfiClientId
* edfiClientSecret
* scenariosVersion
* scenariosGroup
* scenarioStep
* parameters (e.g. schoolId, studentName, classPeriodId, etc.)

*Authorization:* Enforce authorization with `@Authorize(...)`, remove `@Public()`.

*Allowlist params:* Add strict allowlist validation for `scenarioPath` against `certification-scenarios.json`; reject invalid input with `4xx` before command execution. Build the `scenarioPath` from the provided parameters `scenariosVersion`/`scenariosGroup`/`scenariosName`/`scenarioStep`(e.g. v4/MasterSchedule/BellSchedules/01 - Check BellSchedule is valid).

*Configuration:* Update the `SIS/environments/<environment-name>.bru` file. Update the `baseURL` with `odsURL` using the [Bruno CLI setup options](https://docs.usebruno.com/bru-cli/commandOptions#setup-options).

Using the `edfiClientId` and `edfiClientSecret` parameters, the api will update the `SIS/.env` file:

``` txt
EDFI_CLIENT_ID=<replace with edfiClientId parameter>
EDFI_CLIENT_SECRET=<replace with edfiClientSecret parameter>
```

> __Alternative:__ Pass the environment variables directly to the Bruno CLI ([Passing Environment Variables](https://docs.usebruno.com/bru-cli/runCollection#passing-environment-variables))

*Authentication:* Either by environment files or `--env-var` commands, the Certification Bruno solution is already prepared to authenticate and generate a new `token`, see [SIS collection](https://github.com/Ed-Fi-Alliance-OSS/certification-testing/blob/main/bruno/SIS/collection.bru) file as a reference. Once authenticated the `SIS collection` will cache the `token` generated, no need for token and credentials handling.

*Validation:* Map the desired certification scenarios configuration in a JSON file `certification-scenarios.json` with the schema defined in [ADMIN APP - API - Create a Certification Scenarios API](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api).

Bruno CLI will return a report ([Generating Reports](https://docs.usebruno.com/bru-cli/builtInReporters#json-report)) with all assertions and tests statuses among the response data:

> __Important:__ Some commands like `--output` and `--format` are *DEPRECATED*  [Output & Reporting options](https://docs.usebruno.com/bru-cli/commandOptions#output-&-reporting-options)

```code
bru run --reporter-json results.json
```

*Structured API response:* Replace the raw console response with a simplified structured response.

Raw response:

```txt

    01 - Check BellSchedule is valid - API Response: {
      bellScheduleName: Normal Schedule,
      schoolId: 255901107,
      classPeriods: [
        01 - Traditional,
        05 - Traditional,
        06 - Traditional,
        07 - Traditional,
        02 - Traditional,
        04 - Traditional,
        03 - Traditional
      ],
      dates: [],
      startTime: 08:30:00,
      endTime: 15:50:00,
      alternateDayName: undefined,
      totalInstructionalTime: 350,
      id: 505c7aefa1244724987ec326cec4af17,
      lastModifiedDate: 2024-06-07T21:13:41.703707Z
    }

    Assertions

    ✓ res.status: eq 200
    ✓ res.body: isArray
    ✓ res.body: isNotEmpty
    ✓ res.body[0].id: isString
    ✓ res.body[0].id: isNotEmpty
    ✓ res.body[0].bellScheduleName: isString
    ✓ res.body[0].bellScheduleName: isNotEmpty
    ✕ res.body[0].alternateDayName: isString
       expected undefined to be a string
    ✕ res.body[0].alternateDayName: isNotEmpty
       .empty was passed non-string primitive undefined
    ✓ res.body[0].schoolReference: isDefined
    ✓ res.body[0].schoolReference.schoolId: isNumber
    ✓ res.body[0].schoolReference.schoolId: neq 0
    ✓ res.body[0].classPeriods: isArray
    ✓ res.body[0].classPeriods: isNotEmpty
    ✓ res.body[0].classPeriods[0].classPeriodReference: isDefined
    ✓ res.body[0].classPeriods[0].classPeriodReference.classPeriodName: isString
    ✓ res.body[0].classPeriods[0].classPeriodReference.classPeriodName: isNotEmpty
```

Simplified response: The Certification API will parse and format the Bruno CLI report in a JSON format that AdminAPP can handle:

```json
  {
    "scenarioStep": "01 - Check BellSchedule is valid",
    "lastModifiedDate": "00272024-06-07T21:13:41.703707Z",
    "isValid": false,
    "successful": 15,
    "errors": 2,
    "validation-errors": [
      {
        "property": "alternateDayName",
        "validation": "isString",
        "error": "expected undefined to be a string"
      },
      {
        "property": "alternateDayName",
        "validation": "isNotEmpty",
        "error": ".empty was passed non-string primitive undefined"
      }
    ]
  }
```

__Acceptance Criteria:__

* AdminAPP will expose a new api for scenario validations.
* AdminAPP will reject invalid `scenarioPath` inputs with a 4xx response before command execution.
* AdminAPP rejects invalid `scenarioPath` and `env` inputs with a 4xx response before command execution.
* AdminAPP rejects invalid `scenarioPath` and `env` inputs with a 4xx response before command execution.
* AdminAPP generates a temporary `working` scenario with the replaced parameters.
* AdminAPP executes the`working` scenario from the collection root (`bruno`).
* AdminAPP records execution metadata (`artifactVersion`, `commitSha`, scenario, duration, exitCode) in logs for traceability.
* AdminAPP cleans stale temporary work folders based on retention policy (after execution).
* AdminAPP returns a structured API response with `scenarioName` and `TestsResults`.

__Dependencies:__

* [ADMIN APP - API - Import Bruno artifacts](./CERT-220.md#admin-app---api---import-bruno-artifacts)
* [ADMIN APP - API - Create a Certification Scenarios API](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api)

___

#### ADMIN APP - FE - Create Certification Module

__Description:__

As a user, once I properly configured the `Environment`, `ODS Instance`, `Ownership`, and select the correspoding `Team`, I want: 

* The frontend to display a new `Certification` option in the lateral menu.
* When the user clicks on the `Certification` option, the frontend will display a new Page to start the certification process.
* The frontend will display the list of certification scenarios defined in [ADMIN APP - API - Create a Certification Scenarios API](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api)

__Dependencies:__

* [ADMIN APP - API - Create a Certification Scenarios API](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api)

___

#### ADMIN APP - FE - Create Certification Process Page

__Description:__

As a user, once I select a certification scenario, I want: 

* The frontend to display a new `Certification Process` page.
* The frontend will ask the user to enter the required parameters dynamically according to the parameters in the [certification scenarios](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api) list.
* When the enters the parameters and sends the request, the fronend must send the client credentials and required parameters.
* The frontend must display the response from the api [ADMIN APP - API - Scenario Validator Service](./CERT-220.md#admin-app---api---create-a-scenario-validator-service)

__Dependencies:__

* [ADMIN APP - API - Scenario Validator Service](./CERT-220.md#admin-app---api---create-a-scenario-validator-service)
* [ADMIN APP - API - Create a Certification Scenarios API](./CERT-220.md#admin-app---api---create-a-certification-scenarios-api)

___

## Impediments

* Bruno scripts are static, it means it executes the scripts as they were defined, there is no way to set the requests parameters via Bruno CLI.

## Risks

* Conecting two diferent repositories and impatible (by nature) repositories is a time demanding effort. For the sake of the Phase 1 many features taken out of scope but the team still has only 1.5 sprints to develop a high complexity feature, this feature will demand a full dedication from the team in charge.

## Proof of concepts

To overcome the blockers mentioned in the [impediments](./CERT-220.md#impediments) section, many POCs were made to confirm feasibility and connection between `Ed-Fi-AdminApp` api and `certification-testing` bruno collection. It was determined the conection is viable in two ways, via a Bruno Parser and a Bruno Integrator (recommended option).

### POC 1 - Bruno Parser

This POC takes the Bruno collection `.bru` files and translates them into Javascript executable code, this ensures parameter injection and total customizable behavior.

| PROS | CONS |
|---------|-------|----------------------------|------------------|
| Customizable behavior | High dependency on `certification-testing` structure and versioning |
| Easy parametrization | Minimal structure or version changes may produce breaking changes |
| More control over execution | More implementation complexity |
| Less high privileged executions (system commands) |  |
| No adaptations in `certification-testing` required |  |

__GitHub PR:__

* https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/pull/66

### POC 2 - Bruno Integrator (RECOMMENDED)

This POC still uses the `certification-testing` bruno collection as source of truth, but instead of translating the `.bru` files, it takes advantage of the Bruno CLI, for that, it creates a temporary copy of the bruno collection and replaces the parameters placeholders with the user provided ones in a `working` directory, then the Bruno CLI execute the configured scenario and parses the response.

| PROS | CONS |
|---------|-------|----------------------------|------------------|
| Scenarios execution is deletegated to the Bruno CLI | Less control over execution |
| Dependencies are managed by `certification-testing` it self | The response is managed by Bruno CLI |
| Structure or version updates does not generates breaking changes | Complex logic to format Bruno response |
| Less implementation complexity | High privileged executions (system commands) |

__GitHub PRs:__

* https://github.com/Ed-Fi-Alliance-OSS/Ed-Fi-AdminApp/pull/68
* https://github.com/Ed-Fi-Alliance-OSS/certification-testing/pull/111
