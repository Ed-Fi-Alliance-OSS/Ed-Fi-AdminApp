// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Locator, Page, expect } from '@playwright/test'
import type { OdsCredentials } from '../core/ods-credentials'
import {
  API_FETCH_TIMEOUT_MS,
  API_WRITE_TIMEOUT_MS,
  UI_RENDER_TIMEOUT_MS,
  clickNavLink,
} from './support'

/** Status labels of `STEP_STATUS_DISPLAY` (CertificationStatusIndicator) in the frontend. */
export const STEP_STATUS = {
  notExecuted: 'Not executed',
  running: 'Running',
  success: 'Successful',
  failed: 'Failed',
} as const

/** A validation parameter of a step: the label of its form field and the value to type. */
export type StepParameter = { label: RegExp; value: string }

class CertificationPage {
  private readonly page: Page
  private readonly myProductsLink: Locator
  private readonly requestButton: Locator
  private readonly modal: Locator
  private readonly stepRows: Locator
  private readonly scenarioRows: Locator

  constructor(page: Page) {
    this.page = page
    this.myProductsLink = page.locator('a[title="My products"]')
    this.requestButton = page.getByRole('button', { name: 'Request New Certification' })
    this.modal = page.getByRole('dialog')
    // The steps page lists the steps in the first table; the scenarios page lists scenarios.
    this.stepRows = page.getByRole('table').first().locator('tbody tr')
    this.scenarioRows = page.getByRole('table').first().locator('tbody tr')
  }

  async openMyProducts() {
    await clickNavLink(this.page, this.myProductsLink, /\/my-products\/?$/)
    await expect(this.page.getByRole('heading', { name: 'My products' })).toBeVisible({
      timeout: API_FETCH_TIMEOUT_MS,
    })
  }

  /**
   * Requests a certification run for the data store whose credentials are `creds`. When the data
   * store already has an open run (only one is allowed per data store and model) the existing run
   * is opened instead, so a rerun on the same stack works.
   */
  async requestCertification(creds: OdsCredentials, environmentName: string): Promise<void> {
    await expect(this.requestButton).toBeVisible({ timeout: API_FETCH_TIMEOUT_MS })
    await this.requestButton.click()
    await expect(this.modal).toBeVisible({ timeout: UI_RENDER_TIMEOUT_MS })

    await this.selectOption('Environment', (label) => label.startsWith(environmentName))
    await this.selectOption('Tenant')
    await this.selectOption('ODS')

    // Values go straight into the inputs; they are never logged or asserted on.
    await this.fillWithoutReporting(this.modal.getByLabel('Key', { exact: true }), creds.key)
    await this.fillWithoutReporting(this.modal.getByLabel('Secret', { exact: true }), creds.secret)
    await this.modal.getByRole('button', { name: 'Validate credentials' }).click()
    await expect(this.modal.getByText(/Credentials validated/)).toBeVisible({
      timeout: API_WRITE_TIMEOUT_MS,
    })

    const model = this.modal.getByLabel('Certification Model', { exact: true })
    const openModel = await this.firstOpenModel(model)
    if (openModel === undefined) {
      // The open runs of the data store are loaded, so a free model is selectable.
      await this.selectOption('Certification Model', undefined, (label) => !label.includes('already open'))
      const start = this.modal.getByRole('button', { name: 'Start Run' })
      await expect(start).toBeEnabled({ timeout: API_FETCH_TIMEOUT_MS })
      await start.click()
      await expect(this.page).toHaveURL(/\/certification\/.*runs?\//, {
        timeout: API_WRITE_TIMEOUT_MS,
      })
      return
    }

    // Reuse the run that is already open.
    await this.modal.getByRole('button', { name: 'Cancel' }).click()
    await this.page
      .getByRole('link', { name: /^Open .+ run on .+/ })
      .first()
      .click()
    await expect(this.page).toHaveURL(/\/certification\/.*runs?\//, { timeout: UI_RENDER_TIMEOUT_MS })
  }

  async scenarioNames(): Promise<string[]> {
    await expect(this.page.getByRole('heading', { name: 'Scenarios' }).first()).toBeVisible({
      timeout: API_FETCH_TIMEOUT_MS,
    })
    await expect(this.scenarioRows.first().getByRole('button', { name: 'Open Scenario' })).toBeVisible({
      timeout: API_FETCH_TIMEOUT_MS,
    })
    return this.scenarioRows.locator('td:nth-child(2)').allInnerTexts()
  }

  async openScenario(name: string) {
    const row = this.scenarioRows.filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    })
    const open = row.getByRole('button', { name: 'Open Scenario' })
    // Open Scenario is enabled once the credentials of the run are validated.
    await expect(open).toBeEnabled({ timeout: API_FETCH_TIMEOUT_MS })
    await open.click()
    await expect(this.page).toHaveURL(/scenarioId=/, { timeout: UI_RENDER_TIMEOUT_MS })
  }

  async stepNames(): Promise<string[]> {
    await expect(this.stepRows.first()).toBeVisible({ timeout: API_FETCH_TIMEOUT_MS })
    // The rows render as the steps arrive: the first row can be on screen alone for a moment, so
    // wait until two reads half a second apart agree.
    let previous: string[] = []
    await expect
      .poll(
        async () => {
          const current = await this.stepRows.locator('td:nth-child(1)').allInnerTexts()
          const stable = current.length > 0 && current.join('|') === previous.join('|')
          previous = current
          return stable
        },
        { timeout: API_FETCH_TIMEOUT_MS, intervals: [500] },
      )
      .toBe(true)
    return previous
  }

  /**
   * Opens the step, fills the validation parameters it asks for and executes it, waiting until it
   * leaves the running state. `parameters` maps a field label (matched against the form labels of
   * the step) to the value to type; a field with no match stays empty and keeps Execute disabled.
   */
  async executeStep(index: number, parameters: StepParameter[] = []) {
    const row = this.stepRows.nth(index)
    await row.getByRole('button', { name: 'Open' }).click()
    const execute = this.page.getByRole('button', { name: 'Execute step' })
    await expect(execute).toBeVisible({ timeout: UI_RENDER_TIMEOUT_MS })
    // The parameter form sits next to the Execute button; the credential form is the only other
    // one with inputs on the page (Key, Secret).
    const form = this.page.locator('form')
    for (const labelText of await form.locator('label').allInnerTexts()) {
      const parameter = parameters.find(({ label }) => label.test(labelText))
      if (parameter) await form.getByLabel(labelText, { exact: true }).fill(parameter.value)
    }
    await expect(
      execute,
      `Execute step stayed disabled for step ${index + 1}; its parameters: ${(await form.locator('label').allInnerTexts()).join(', ')}`,
    ).toBeEnabled({ timeout: UI_RENDER_TIMEOUT_MS })
    // Wait for the run request itself: on a run that was executed before, the row already shows a
    // result, so "no Running and no Not executed" is true before the click has any effect.
    const executed = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && /\/certification\/runs\/\d+\/steps?\//.test(response.url()),
      { timeout: API_WRITE_TIMEOUT_MS },
    )
    await execute.click()
    await executed
    await expect(row.getByText(STEP_STATUS.running)).toHaveCount(0, { timeout: API_WRITE_TIMEOUT_MS })
    await expect(row.getByText(STEP_STATUS.notExecuted)).toHaveCount(0, {
      timeout: API_WRITE_TIMEOUT_MS,
    })
  }

  async stepStatus(index: number): Promise<string> {
    const text = await this.stepRows.nth(index).locator('td:nth-child(2)').innerText()
    return text.trim()
  }

  /**
   * Types a value into a React input without `locator.fill(value)`: the reporters (Allure, trace)
   * print the value in the step title `Fill "<value>"`, which would put the ODS secret in the report.
   */
  private async fillWithoutReporting(input: Locator, value: string) {
    await input.evaluate((element, text) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(element, text)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
  }

  /** Selects an option of a native select in the modal; by default the first real option. */
  private async selectOption(
    label: string,
    pickLabel: (optionLabel: string) => boolean = () => true,
    pickAlso: (optionLabel: string) => boolean = () => true,
  ) {
    const select = this.modal.getByLabel(label, { exact: true })
    await expect(select).toBeVisible({ timeout: UI_RENDER_TIMEOUT_MS })
    // A list with a single option is chosen by the app and disabled; wait for it to settle.
    await expect
      .poll(async () => (await select.locator('option').allInnerTexts()).length, {
        timeout: API_FETCH_TIMEOUT_MS,
      })
      .toBeGreaterThan(1)
    if (await select.isDisabled()) return
    const labels = await select.locator('option').allInnerTexts()
    const wanted = labels.find((text, index) => index > 0 && pickLabel(text) && pickAlso(text))
    if (wanted === undefined) throw new Error(`No option for "${label}" matched`)
    await select.selectOption({ label: wanted })
  }

  /** The first Certification Model whose run is already open, if any. */
  private async firstOpenModel(model: Locator): Promise<string | undefined> {
    await expect(model).toBeVisible({ timeout: UI_RENDER_TIMEOUT_MS })
    await expect
      .poll(async () => (await model.locator('option').allInnerTexts()).length, {
        timeout: API_FETCH_TIMEOUT_MS,
      })
      .toBeGreaterThan(1)
    const labels = await model.locator('option').allInnerTexts()
    return labels.find((text) => text.includes('already open'))
  }
}

export default CertificationPage
