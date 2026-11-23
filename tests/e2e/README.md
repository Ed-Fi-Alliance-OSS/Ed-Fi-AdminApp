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
  `compose/.env`. For the Data Standard 5 image pass the template and image parameters described in
  `eng/testing/README.md`.
- Run on its own against a stack that has already run the setup projects:
  `E2E_SKIP_V1=1 npx playwright test certification.feature --project=chromium-certification --no-deps`
- ODS credentials are created through the Admin API with `core/ods-credentials.ts` (unique names per
  call). They stay in memory; `fillWithoutReporting` types them so the value is not in the Allure step
  title, and the project runs with `trace: 'off'`.
- A second run on the same stack reuses the open run of the data store instead of requesting a new one.
- The Admin API rate limits `/connect/register`; the helper retries on 429 and can wait up to two minutes.
- The setup projects are not rerunnable on a used stack ("membership already exists"), and
  `chromium-ownerships` changes the `ApiTest` ownership. Reset with `./compose/stop.ps1 -V` before a
  full rerun.

## Notes

- Feature files (`*.feature`) define scenarios using Gherkin syntax.
- Step definitions (`*.steps.ts`) implement the Given/When/Then steps.
- `bddgen` must run before `playwright test` to regenerate specs from feature files.
- Allure results are written to `test-results/allure-results` after each test run.
