# E2E Tests

BDD end-to-end tests using [playwright-bdd](https://github.com/vitalets/playwright-bdd) and [Allure](https://allurereport.org/).

## Commands

### Run All the Tests

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test
```

### Run one test or specific .feature file

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test teams.feature
npx bddgen --config=./playwright.config.ts && npx playwright test -g "Delete Team"
```

### Run Tests in Debug Mode

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test --debug
```

### Run Tests in Headed Mode

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test --headed
```

### Generate and Open Allure Report

```bash
npx allure open test-results/allure-results
```

## Structure

```
tests/e2e/
├── core/              # Shared routes, constants and the Admin API ODS credentials helper
├── pages/             # Page Object Models (POMs)
├── certification-page/ # Certification vendor happy path (feature and steps)
├── login-page/        # Login feature and step definitions
├── main-page/         # Home page feature and step definitions
└── .features-gen/     # Auto-generated test specs (do not edit)
```

## Certification feature

`certification-page/certification.feature` creates a certification run in the UI and executes the
Schools scenario. It runs in the `chromium-certification` project, after `chromium-environmentv2andApi`
(it needs the `FullSingleEnvironmentv2` environment and the `ApiTest` team) and before
`chromium-ownerships`.

- Stack: Ed-Fi ODS/API 7.3 with Data Standard 5.2 (single tenant, Admin API v2) and the certification
  runtime on (`CERT_ENABLED=true`). `eng/testing/run-e2e-ui.ps1` sets `CERT_ENABLED` in the generated
  `compose/.env`. The defaults of `run-e2e-ui.ps1` are the DS 5.2 templates and image; certification requires Data Standard 5
  (below it the request modal does not list the environment, so this feature would time out).
  `run-e2e-ui.ps1 -OdsDataStandard <non-5>` or `E2E_SKIP_CERTIFICATION=1` skip the feature; see
  `eng/testing/README.md`.
- Run on its own against a stack that has already run the setup projects:
  `E2E_SKIP_V1=1 npx playwright test certification.feature --project=chromium-certification --no-deps`
- ODS credentials are created through the Admin API with `core/ods-credentials.ts` (unique names per
  call). They stay in memory; `fillWithoutReporting` types them so the value is not in the Allure step
  title, and the project runs with `trace: 'off'`.
- A second run on the same stack reuses the open run of the data store instead of requesting a new one.
- The Schools steps 3 and 4 (`UPDATE`) assert that a school field changed, so the test changes it first
  through the ODS API (`core/ods-api.ts`) with a second application on the `Ed-Fi Sandbox` claim set
  (`SIS Vendor` can only read education organizations). The new value carries a per-run suffix, so reruns
  keep passing. All four steps and the scenario status are asserted `Successful`.
- `run-e2e-ui.ps1` sets `TPDM_ENABLED=false` in the generated `compose/.env`: the DS 5.2 templates have no
  TPDM tables, and a school write fails while the TPDM plugin is loaded. With `-KeepEnvFile` set it yourself.
- The Admin API rate limits `/connect/register`; the helper retries on 429 and can wait up to two minutes. Both ODS applications are created in the Given step, and the project timeout is 5 minutes to cover that worst case.
- The test is meant for disposable stacks: every run leaves a vendor and two applications in the Admin API and rewrites two schools in the ODS.
- The setup projects are not rerunnable on a used stack ("membership already exists"), and
  `chromium-ownerships` changes the `ApiTest` ownership. Reset with `./compose/stop.ps1 -V` before a
  full rerun.

## Notes

- Feature files (`*.feature`) define scenarios using Gherkin syntax.
- Step definitions (`*.steps.ts`) implement the Given/When/Then steps.
- `bddgen` must run before `playwright test` to regenerate specs from feature files.
- Allure results are written to `test-results/allure-results` after each test run.
