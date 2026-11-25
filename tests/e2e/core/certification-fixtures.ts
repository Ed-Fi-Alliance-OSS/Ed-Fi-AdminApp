// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

/**
 * Environment-specific values of the certification E2E, in one place. They match the
 * single-tenant Admin API v2 topology (`odsV7-adminV2`) with the populated Data Standard 5.2 template;
 * extending the test to another tenancy or data standard starts here.
 */

/** Admin API v2 of the single-tenant topology. Override with `E2E_ADMIN_API_URL`. */
export const ADMIN_API_URL =
  process.env.E2E_ADMIN_API_URL ?? 'https://localhost/odsv7-adminv2-single-adminapi'

/** ODS/API of the single-tenant topology. Override with `E2E_ODS_URL`. */
export const ODS_URL = process.env.E2E_ODS_URL ?? 'https://localhost/odsv7-adminv2-single-api'

/** The district of the populated template: the education organization the test applications may access. */
export const DISTRICT_EDUCATION_ORGANIZATION_ID = 255901

/** The ODS instance of the single-tenant topology, as registered in the Admin API. */
export const ODS_INSTANCE_ID = 1

/** Schools of the populated template that the Schools scenario asks for. */
export const FIRST_SCHOOL_ID = '255901001'
export const SECOND_SCHOOL_ID = '255901044'
