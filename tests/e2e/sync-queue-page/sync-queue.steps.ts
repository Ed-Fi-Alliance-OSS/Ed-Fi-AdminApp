// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import SyncQueuePage from '../pages/sync-queue-page'

const { When, Then } = createBdd()

let syncQueuePage: SyncQueuePage

When('the user clicks the Sync queue option', async ({ page }) => {
  syncQueuePage = new SyncQueuePage(page)
  await syncQueuePage.clickSyncQueueOption()
})

Then('the sync table should be displayed with all task completed', async () => {
  await syncQueuePage.allTasksShouldBeCompleted()
})
