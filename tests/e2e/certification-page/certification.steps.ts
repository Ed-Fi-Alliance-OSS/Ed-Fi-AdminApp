// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { FIRST_SCHOOL_ID, SECOND_SCHOOL_ID } from '../core/certification-fixtures'
import { SchoolField, changeSchoolField } from '../core/ods-api'
import { OdsCredentials, createOdsCredentials } from '../core/ods-credentials'
import CertificationPage, { STEP_STATUS, StepParameter, StepRunResult } from '../pages/certification-page'
import { API_FETCH_TIMEOUT_MS } from '../pages/support'

const { Given, When, Then } = createBdd()

// Schools of the populated Ed-Fi ODS template (Data Standard 5.2) that the Schools scenario asks for.
const SCHOOL_PARAMETERS: StepParameter[] = [
  { label: /first school/i, value: FIRST_SCHOOL_ID },
  { label: /second school/i, value: SECOND_SCHOOL_ID },
]

// SIS Vendor only reads education organizations, so the school changes use an application on a
// claim set that can write them.
const SCHOOL_WRITER_CLAIM_SET = 'Ed-Fi Sandbox'

// What each UPDATE step of the Schools scenario expects changed, in the order the UPDATE steps appear.
// The steps are recognised by name (the catalog derives the step type from it too), not by position, so
// reordering or adding CREATE steps in the catalog does not move the changes onto the wrong steps.
const UPDATE_STEP_NAME = /update/i
const SCHOOL_CHANGES: { schoolId: string; field: SchoolField }[] = [
  { schoolId: FIRST_SCHOOL_ID, field: 'streetNumberName' },
  { schoolId: SECOND_SCHOOL_ID, field: 'postalCode' },
]

// Unique per run, so a rerun on the same stack always writes a value the ODS does not hold yet.
const runSuffix = Date.now().toString(36)

let certificationPage: CertificationPage
// Kept in memory only: the key and secret are never printed, attached or written to disk.
let odsCredentials: OdsCredentials
let schoolWriter: OdsCredentials
// What the run endpoint answered for each executed step: the source of truth for the outcome, because
// on a rerun the rows already show the previous run's status until the UI refetches.
let stepResults: StepRunResult[] = []

// Both applications are created here, up front: the Admin API rate limiter can make each creation
// wait for minutes, and that wait must not surface in the middle of the step execution.
Given('the vendor has ODS credentials for the data store', async ({ request }) => {
  odsCredentials = await createOdsCredentials(request)
  schoolWriter = await createOdsCredentials(request, { claimSetName: SCHOOL_WRITER_CLAIM_SET })
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
  const names = await certificationPage.stepNames()
  const count = names.length
  const updateSteps = names.flatMap((name, index) => (UPDATE_STEP_NAME.test(name) ? [index] : []))
  expect(
    updateSteps,
    `the scenario should have ${SCHOOL_CHANGES.length} UPDATE steps; its steps are: ${names.join(' | ')}`,
  ).toHaveLength(SCHOOL_CHANGES.length)
  stepResults = []
  for (let index = 0; index < count; index++) {
    const change = SCHOOL_CHANGES[updateSteps.indexOf(index)]
    // An UPDATE step asserts that the school differs from the value captured by the step before it,
    // so the vendor's own system (here, the ODS API) has to change it first.
    if (change) {
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
