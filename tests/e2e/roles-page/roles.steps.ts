// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd';
import RolesPage from '../pages/roles-page';

const { When, Then } = createBdd();

let rolesPage: RolesPage;

When('the user clicks the Roles option', async ({ page }) => {
  rolesPage = new RolesPage(page);
  await rolesPage.clickRolesOption();
});

When('the user clicks the Create new role button', async () => {
  await rolesPage.clickCreateNewButton();
});

When(
  /^the user fills the role fields ([^,]+), ([^,]+), ([^,]+), (.+)$/,
  async ({}, name: string, description: string, type: string, privileges: string) => {
    await rolesPage.fillRequiredFields(
      name.trim(),
      description.trim(),
      type.trim(),
      privileges.trim(),
    );
  },
);

When(
  /^the user updates the role fields ([^,]+), ([^,]+), (.+)$/,
  async ({}, name: string, description: string, privileges: string) => {
    await rolesPage.updateRequiredFields(name.trim(), description.trim(), privileges.trim());
  },
);

When('the user clicks the save role button', async () => {
  await rolesPage.clickSaveButton();
});

When('the user clicks the cancel role button', async () => {
  await rolesPage.clickCancelButton();
});

When(/^the user filter the role created(?: (.+))?$/, async ({}, roleName?: string) => {
  await rolesPage.filterRoleCreated(roleName?.trim());
});

When(/^the user clicks the (View|Edit|Delete) role action$/, async ({}, action: string) => {
  await rolesPage.clickRoleAction(action.toLowerCase() as 'view' | 'edit' | 'delete');
});

When(/^the user clicks role named (.+)$/, async ({}, roleName: string) => {
  await rolesPage.clickRole(roleName.trim());
});

When('the user clicks the edit role tab', async () => {
  await rolesPage.clickEditTab();
});

When('the user clicks the delete role tab', async () => {
  await rolesPage.clickDeleteTab();
});

When('the user confirms role deletion', async () => {
  await rolesPage.confirmDelete('yes');
});

When('the user cancels role deletion', async () => {
  await rolesPage.confirmDelete('no');
});

Then(
  /^the new role details should display ([^,]+), ([^,]+), (.+)$/,
  async ({}, name: string, type: string, privileges: string) => {
    await rolesPage.newRoleDetailsShouldBeDisplayed(name.trim(), type.trim(), privileges.trim());
  },
);

Then(
  /^the updated role details should display (.+) and (.+)$/,
  async ({}, name: string, description: string) => {
    await rolesPage.updatedRoleDetailsShouldBeDisplayed(name.trim(), description.trim());
  },
);

Then(/^role (.+) should not be created$/, async ({}, name: string) => {
  await rolesPage.roleShouldNotBeCreated(name.trim());
});

Then('the role list should be loaded', async () => {
  await rolesPage.rolesPageShouldBeLoaded();
});

Then('the role description, type, and privileges should be displayed', async () => {
  await rolesPage.roleDetailsShouldBeDisplayed();
});

Then('the selected role should be removed from the role table', async () => {
  await rolesPage.selectedRoleShouldBeRemoved();
});

Then('the selected role should not be removed from the role table', async () => {
  await rolesPage.selectedRoleShouldNotBeRemoved();
});
