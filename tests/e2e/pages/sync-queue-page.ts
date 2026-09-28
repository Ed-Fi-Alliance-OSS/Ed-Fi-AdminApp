// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect, Page } from '@playwright/test'
import { API_FETCH_TIMEOUT_MS } from './support'

class SyncQueuePage {
  private readonly syncQueueOption
  private readonly pageHeading
  private readonly syncQueueTable
  private readonly tableRows

  constructor(private readonly page: Page) {
    this.syncQueueOption = this.page.getByRole('link', { name: 'Sync queue', exact: true })
    this.pageHeading = this.page.getByRole('heading', { name: 'Ed-Fi Data Store Sync Queue' })
    this.syncQueueTable = this.page.locator('table')
    this.tableRows = this.page.locator('tbody tr')
  }

  async clickSyncQueueOption() {
    await this.syncQueueOption.click()
    await this.syncTableShouldBeDisplayed()
  }

  async syncTableShouldBeDisplayed() {
    await expect(this.pageHeading).toBeVisible({ timeout: API_FETCH_TIMEOUT_MS })
    await expect(this.syncQueueTable).toBeVisible({ timeout: API_FETCH_TIMEOUT_MS })
  }

  async allTasksShouldBeCompleted() {
    await expect(async () => {
      const rowCount = await this.tableRows.count()
      expect(rowCount, 'The sync queue table has no task rows').toBeGreaterThan(0)

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = this.tableRows.nth(rowIndex)
        if (await row.getByText('failed', { exact: true }).count()) {
          continue
        }

        await expect(row).toContainText('completed', { timeout: 1000 })
      }
    }).toPass({ timeout: API_FETCH_TIMEOUT_MS, intervals: [1000, 3000] })
  }
}

export default SyncQueuePage
