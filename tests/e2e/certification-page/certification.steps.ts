// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { OdsCredentials, createOdsCredentials } from '../core/ods-credentials'
import CertificationPage, { STEP_STATUS, StepParameter } from '../pages/certification-page'
import { API_FETCH_TIMEOUT_MS } from '../pages/support'

const { Given, When, Then } = createBdd()

// Schools of the populated Ed-Fi ODS template (Data Standard 5.2) that the Schools scenario asks for.
const SCHOOL_PARAMETERS: StepParameter[] = [
  { label: /first school/i, value: '255901001' },
  { label: /second school/i, value: '255901044' },
]

let certificationPage: CertificationPage
// Kept in memory only: the key and secret are never printed, attached or written to disk.
let odsCredentials: OdsCredentials

Given('the vendor has ODS credentials for the data store', async ({ request }) => {
  odsCredentials = await createOdsCredentials(request)
})

When(
  /^the user requests a new certification for (.+)$/,
  async ({ page }, environmentName: string) => {
    certificationPage = new CertificationPage(page)
    await certificationPage.openMyProducts()
    await certificationPage.requestCertification(odsCredentials, environmentName)
  },
)

Then('the Scenarios page lists at least one scenario', async () => {
  const names = await certificationPage.scenarioNames()
  expect(names.length).toBeGreaterThan(0)
})

When(/^the user opens the (.+) scenario$/, async ({}, name: string) => {
  await certificationPage.openScenario(name)
})

Then('its steps are listed', async () => {
  const names = await certificationPage.stepNames()
  expect(names.length).toBeGreaterThan(0)
})

When('the user executes the steps of the scenario', async () => {
  const count = (await certificationPage.stepNames()).length
  for (let index = 0; index < count; index++) {
    await certificationPage.executeStep(index, SCHOOL_PARAMETERS)
  }
})

Then('the first two steps report Successful', async () => {
  await expect
    .poll(() => certificationPage.stepStatus(0), { timeout: API_FETCH_TIMEOUT_MS })
    .toBe(STEP_STATUS.success)
  await expect
    .poll(() => certificationPage.stepStatus(1), { timeout: API_FETCH_TIMEOUT_MS })
    .toBe(STEP_STATUS.success)
})

// The last steps are expected to fail for now (the Schools scenario needs a school address
// change through the schools endpoint); they only have to report a result.
Then('the remaining steps report a result', async () => {
  const count = (await certificationPage.stepNames()).length
  for (let index = 2; index < count; index++) {
    const status = await certificationPage.stepStatus(index)
    expect([STEP_STATUS.success, STEP_STATUS.failed]).toContain(status)
  }
})
