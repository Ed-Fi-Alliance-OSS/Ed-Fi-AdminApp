// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import type { APIRequestContext, APIResponse } from '@playwright/test'
import { randomBytes } from 'node:crypto'

export type OdsCredentials = { key: string; secret: string }

const DEFAULT_ADMIN_API_URL = 'https://localhost/odsv7-adminv2-single-adminapi'
const BASE_CLAIM_SET = 'SIS Vendor'
const MAX_ATTEMPTS = 12
const RETRY_DELAY_MS = 10_000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends a request and retries while the Admin API rate limiter answers 429. Bodies are never
 * logged: responses of this flow carry tokens and the ODS secret.
 */
async function send(
  what: string,
  call: () => Promise<APIResponse>
): Promise<APIResponse> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await call()
    if (response.status() !== 429) {
      if (!response.ok()) {
        throw new Error(`Admin API ${what} failed with status ${response.status()}`)
      }
      return response
    }
    await delay(RETRY_DELAY_MS)
  }
  throw new Error(`Admin API ${what} was rate limited (429) ${MAX_ATTEMPTS} times`)
}

/**
 * Creates a fresh ODS key/secret through Admin API v2 (single tenant): registers a client, creates
 * a vendor and creates an application on the `SIS Vendor` claim set. Vendor and application names carry
 * a unique suffix so reruns on the same stack do not collide.
 *
 * The spec copied `SIS Vendor` to a unique claim set first, but the ODS caches its security metadata:
 * a freshly copied claim set answers 403 on every resource for about 2.5 minutes, so the application
 * uses the reserved `SIS Vendor` claim set directly (it is never modified here).
 */
export async function createOdsCredentials(
  request: APIRequestContext,
  options: { adminApiUrl?: string } = {}
): Promise<OdsCredentials> {
  const adminApi = options.adminApiUrl ?? DEFAULT_ADMIN_API_URL
  const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const clientId = `e2e-cert-${suffix}`
  const clientSecret = `Cs-${randomBytes(24).toString('hex')}`

  await send('register', () =>
    request.post(`${adminApi}/connect/register`, {
      form: { ClientId: clientId, ClientSecret: clientSecret, DisplayName: clientId },
    })
  )

  const tokenResponse = await send('token', () =>
    request.post(`${adminApi}/connect/token`, {
      form: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'edfi_admin_api/full_access',
      },
    })
  )
  const token = ((await tokenResponse.json()) as { access_token: string }).access_token
  const headers = { Authorization: `Bearer ${token}` }

  const vendorResponse = await send('create vendor', () =>
    request.post(`${adminApi}/v2/vendors`, {
      headers,
      data: {
        company: `E2E Cert Vendor ${suffix}`,
        namespacePrefixes: 'uri://ed-fi.org',
        contactName: 'E2E Contact',
        contactEmailAddress: 'e2e@example.org',
      },
    })
  )
  const vendorId = Number(vendorResponse.headers()['location']?.split('/').pop())
  if (!Number.isInteger(vendorId)) {
    throw new Error('Admin API create vendor did not return a Location header with the vendor id')
  }

  const claimSetsResponse = await send('list claim sets', () =>
    request.get(`${adminApi}/v2/claimSets`, { headers, params: { name: BASE_CLAIM_SET } })
  )
  // The list is paged (25 by default), so filter by name: the base claim set is not always on page 1.
  const claimSets = (await claimSetsResponse.json()) as { name: string }[]
  if (!claimSets.some((claimSet) => claimSet.name === BASE_CLAIM_SET)) {
    throw new Error(`Claim set "${BASE_CLAIM_SET}" not found in the Admin API`)
  }

  const applicationResponse = await send('create application', () =>
    request.post(`${adminApi}/v2/applications`, {
      headers,
      data: {
        applicationName: `E2E Cert App ${suffix}`,
        vendorId,
        claimSetName: BASE_CLAIM_SET,
        educationOrganizationIds: [255901],
        odsInstanceIds: [1],
      },
    })
  )
  const { key, secret } = (await applicationResponse.json()) as OdsCredentials
  if (!key || !secret) {
    throw new Error('Admin API create application did not return a key and secret')
  }
  return { key, secret }
}
