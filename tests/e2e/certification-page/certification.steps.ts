// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { SchoolField, changeSchoolField } from '../core/ods-api'
import { OdsCredentials, createOdsCredentials } from '../core/ods-credentials'
import CertificationPage, { STEP_STATUS, StepParameter, StepRunResult } from '../pages/certification-page'
import { API_FETCH_TIMEOUT_MS } from '../pages/support'

const { Given, When, Then } = createBdd()

// Schools of the populated Ed-Fi ODS template (Data Standard 5.2) that the Schools scenario asks for.
const SCHOOL_PARAMETERS: StepParameter[] = [
  { label: /first school/i, value: '255901001' },
  { label: /second school/i, value: '255901044' },
]

// SIS Vendor only reads education organizations, so the school changes use an application on a
// claim set that can write them.
const SCHOOL_WRITER_CLAIM_SET = 'Ed-Fi Sandbox'

// The UPDATE steps of the Schools scenario, by step index: the school and field each one expects changed.
const SCHOOL_CHANGES: Record<number, { schoolId: string; field: SchoolField }> = {
  2: { schoolId: '255901001', field: 'streetNumberName' },
  3: { schoolId: '255901044', field: 'postalCode' },
}

// Unique per run, so a rerun on the same stack always writes a value the ODS does not hold yet.
const runSuffix = Date.now().toString(36)

let certificationPage: CertificationPage
// Kept in memory only: the key and secret are never printed, attached or written to disk.
let odsCredentials: OdsCredentials
let schoolWriter: OdsCredentials | undefined
// What the run endpoint answered for each executed step: the source of truth for the outcome, because
// on a rerun the rows already show the previous run's status until the UI refetches.
let stepResults: StepRunResult[] = []

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

When('the user executes the steps of the scenario', async ({ request }) => {
  const count = (await certificationPage.stepNames()).length
  stepResults = []
  for (let index = 0; index < count; index++) {
    const change = SCHOOL_CHANGES[index]
    // An UPDATE step asserts that the school differs from the value captured by the step before it,
    // so the vendor's own system (here, the ODS API) has to change it first.
    if (change) {
      schoolWriter ??= await createOdsCredentials(request, { claimSetName: SCHOOL_WRITER_CLAIM_SET })
      await changeSchoolField(request, schoolWriter, change.schoolId, change.field, runSuffix)
    }
    stepResults.push(await certificationPage.executeStep(index, SCHOOL_PARAMETERS))
  }
})

Then('all steps report Successful', async () => {
  const count = (await certificationPage.stepNames()).length
  expect(stepResults).toHaveLength(count)
  stepResults.forEach(({ status }, index) =>
    expect(status, `step ${index + 1} result from the run endpoint`).toBe('success'),
  )
  expect(stepResults[count - 1].scenarioStatus).toBe('completed')
  for (let index = 0; index < count; index++) {
    await expect
      .poll(() => certificationPage.stepStatus(index), { timeout: API_FETCH_TIMEOUT_MS })
      .toBe(STEP_STATUS.success)
  }
})

When('the user goes back to the scenarios', async () => {
  await certificationPage.backToScenarios()
})

Then(/^the (.+) scenario shows as Successful$/, async ({}, name: string) => {
  await expect
    .poll(() => certificationPage.scenarioStatus(name), { timeout: API_FETCH_TIMEOUT_MS })
    .toBe(STEP_STATUS.success)
})
