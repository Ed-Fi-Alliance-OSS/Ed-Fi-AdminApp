// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Page } from '@playwright/test'

class GrantOwnershipPage {
	constructor(private readonly page: Page) {}

	async assignEnvironmentAccess(
		resourceType: string,
		environment: string,
		team: string,
		role: string
	) {
		await this.page.getByRole('radio', { name: resourceType, exact: true }).check()
		await this.selectComboboxOption('Environment', environment)
		await this.selectComboboxOption('Team', team)
		await this.selectComboboxOption('Role', role)
		await this.page.getByRole('button', { name: 'Save', exact: true }).click()
	}

	private async selectComboboxOption(label: string, optionText: string) {
		const combobox =
			label === 'Team'
				? this.page.locator('div').filter({ hasText: /^Select an option$/ }).nth(4)
				: this.page.getByRole('combobox', { name: label }).first()
		await combobox.click()
		await this.page.keyboard.type(optionText)
		await this.page.keyboard.press('Enter')
	}
}

export default GrantOwnershipPage
