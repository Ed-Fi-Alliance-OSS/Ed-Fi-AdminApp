// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Page, expect } from '@playwright/test'

class TeamsPage {
  private readonly teamsOption
  private readonly createNewButton
  private readonly teamNameInput
  private readonly saveButton
  private readonly cancelButton
  private readonly teamNameSection
  private readonly ownershipsSection
  private readonly membershipsSection
  private readonly teamsTable
  private readonly yesButton
  private readonly noButton
  private readonly scopeMainScreen
  private readonly membershipForm
  private readonly resourseOwnsershipForm

  constructor(private readonly page: Page) {
    this.teamsOption = this.page.locator('a[title="Teams"]')
    this.createNewButton = this.page.locator('a[title="Create new team."]')
    this.teamNameInput = this.page.locator('input[name="name"]')
    this.saveButton = this.page.locator('button:has-text("Save")')
    this.cancelButton = this.page.locator('button:has-text("Cancel")')
    this.teamNameSection = this.page.locator('div').filter({ hasText: /^NameSample Team$/ }).first()
    this.ownershipsSection = this.page.getByText('Add resourceOwnershipsMore')
    this.membershipsSection = this.page.getByText('Add userUser membershipsMore')
    this.teamsTable = this.page.locator('tbody')
    this.yesButton = this.page.locator('button:has-text("Yes")')
    this.noButton = this.page.locator('button:has-text("No")')
    this.scopeMainScreen = this.page.locator('.page-content-card')
    this.membershipForm = this.page.locator('div').filter({ hasText: /^Create new team membership$/ })
    this.resourseOwnsershipForm = page.locator('div').filter({ hasText: /^Grant new resource ownership$/ })
  }

  async clickTeamsOption() {
    await this.teamsOption.click()
  }

  async clickCreateNewButton() {
    await this.createNewButton.click()
  }

  async fillRequiredFields() {
    await this.teamNameInput.fill("Sample Team", {timeout: 500})
  }

  async clickSaveButton() {
    await this.saveButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async clickCancelButton() {
    await this.cancelButton.click()
  }

  async clickOptionFromThreeDots(optionName: string) {
    const firstRow = this.page.locator('tbody td span').first()
    await firstRow.hover()

    switch (optionName.trim().toLowerCase()) {
      case 'assume team scope':
        await this.page.getByRole('link', { name: 'Assume'}).click()
        break
      case 'add existing user to':
        await this.page.getByRole('link', { name: 'Add user'}).click()
        break
      case 'give new resource ownership':
        await this.page.getByRole('link', { name: 'Add resource'}).click()
        break
      case 'view':
        await this.page.getByRole('button', { name: 'more' }).click()
        await this.page.getByRole('menuitem', { name: 'View' }).click()
        break
      case 'edit':
        await this.page.getByRole('button', { name: 'more' }).click()
        await this.page.getByRole('menuitem', { name: 'Edit' }).click()
        break
      case 'delete':
        await this.page.getByRole('button', { name: 'more' }).click()
        await this.page.getByRole('menuitem', { name: 'Delete' }).click()
        break
      default:
        throw new Error(`Unsupported option name: ${optionName}`)
    }
  }

  async setNewTeamName() {
    await this.teamNameInput.fill("TeamUpdated", {timeout: 500})
  }

  async clickPopupButton(optionName: string) {
    switch (optionName.trim().toLowerCase()) {
      case 'yes':
        await this.yesButton.click()
        break
      case 'no':
        await this.noButton.click()
        break
      default:
        throw new Error(`Unsupported option name: ${optionName}`)
    }
  }

  async teamDetailsShouldBeDisplayed() {
    await expect(this.ownershipsSection).toBeVisible();
    await expect(this.membershipsSection).toBeVisible();
  }

  async newTeamShouldNotBeCreated() {
    await expect(this.teamsTable).toBeVisible()
    await expect(this.teamsTable).not.toContainText('TeamUpdated');
  }

  async homeScopePageShouldBeLoaded() {
      await expect(this.scopeMainScreen).toBeVisible();
  }

  async teamMembershipFormShouldBeLoaded() {
    await expect(this.membershipForm).toBeVisible();
  }

  async grantResourceOwnershipFormShouldBeLoaded() {
    await expect(this.resourseOwnsershipForm).toBeVisible();
  }

  async teamNameShouldBeUpdated() {
    await this.teamsOption.click()
    await expect(this.teamsTable).toBeVisible()
    await expect(this.teamsTable).not.toContainText('Sample Team');
  }

  async teamNameShouldNotBeChanged() {
    await this.teamsOption.click()
    await expect(this.teamsTable).toBeVisible()
    await expect(this.teamsTable).toContainText('TeamUpdated');
  }

  async teamShouldBeRemoved() {
    await expect(this.teamsTable).not.toBeVisible()
    await expect(this.teamsTable).not.toContainText('TeamUpdated');
  }

  async teamShouldNotBeRemoved() {
    await expect(this.teamsTable).toBeVisible()
    await expect(this.teamsTable).toContainText('TeamUpdated');
  }
}

export default TeamsPage
