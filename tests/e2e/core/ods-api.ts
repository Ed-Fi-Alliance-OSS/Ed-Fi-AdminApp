// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import type { APIRequestContext, APIResponse } from '@playwright/test'
import { ODS_URL } from './certification-fixtures'
import type { OdsCredentials } from './ods-credentials'

export type SchoolField = 'streetNumberName' | 'postalCode'

const TOKEN_ATTEMPTS = 3
const TOKEN_RETRY_DELAY_MS = 5_000
const STREET_MARKER = ' E2E-'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs a request and, if it fails before any response (timeout, reset, TLS), throws a generic error:
 * Playwright's own message carries a call log with the request headers, including the bearer token.
 */
async function guard(what: string, call: () => Promise<APIResponse>): Promise<APIResponse> {
  try {
    return await call()
  } catch {
    throw new Error(`ODS ${what} request failed`)
  }
}

/** Throws with the status only: bodies and headers of this flow carry the token and the ODS secret. */
function ensureOk(what: string, response: APIResponse): APIResponse {
  if (!response.ok()) throw new Error(`ODS ${what} failed with status ${response.status()}`)
  return response
}

async function getToken(
  request: APIRequestContext,
  creds: OdsCredentials,
  odsUrl: string,
): Promise<string> {
  let response: APIResponse | undefined
  for (let attempt = 1; attempt <= TOKEN_ATTEMPTS; attempt++) {
    response = await guard('token', () =>
      request.post(`${odsUrl}/oauth/token`, {
        form: { client_id: creds.key, client_secret: creds.secret, grant_type: 'client_credentials' },
      }),
    )
    if (![401, 403, 429].includes(response.status())) break
    if (attempt < TOKEN_ATTEMPTS) await delay(TOKEN_RETRY_DELAY_MS)
  }
  ensureOk('token', response as APIResponse)
  return ((await (response as APIResponse).json()) as { access_token: string }).access_token
}

/**
 * The new value of `field`, derived from the current one and `runSuffix` so it differs from it and a
 * rerun on the same stack keeps working:
 * - `streetNumberName`: the current value without a previous ` E2E-<suffix>`, plus the new suffix.
 * - `postalCode`: a 5-digit code from `runSuffix` (base 36), bumped by one if it equals the current.
 */
function nextValue(field: SchoolField, current: string, runSuffix: string): string {
  if (field === 'streetNumberName') {
    const base = current.split(STREET_MARKER)[0]
    return `${base}${STREET_MARKER}${runSuffix}`
  }
  const code = 10000 + (parseInt(runSuffix, 36) % 90000)
  return String(`${code}` === current ? code + 1 : code)
}

/**
 * Changes one address field of a school through the ODS/API (GET, then PUT with the ETag as
 * `If-Match`), so a certification `UPDATE` step finds a value different from the one it captured.
 */
export async function changeSchoolField(
  request: APIRequestContext,
  creds: OdsCredentials,
  schoolId: string,
  field: SchoolField,
  runSuffix: string,
  options: { odsUrl?: string } = {},
): Promise<void> {
  const odsUrl = options.odsUrl ?? ODS_URL
  const headers = { Authorization: `Bearer ${await getToken(request, creds, odsUrl)}` }
  const collection = `${odsUrl}/data/v3/ed-fi/schools`

  // The resource id of a school is a GUID: find it through its natural key (schoolId).
  const found = ensureOk('find school', await guard('find school', () => request.get(collection, { headers, params: { schoolId } })))
  const matches = (await found.json()) as { id: string }[]
  if (matches.length !== 1) throw new Error(`ODS school ${schoolId} was not found`)
  const url = `${collection}/${matches[0].id}`

  const current = ensureOk('get school', await guard('get school', () => request.get(url, { headers })))
  const body = (await current.json()) as { addresses?: Record<string, string>[] }
  const address = body.addresses?.[0]
  if (!address) throw new Error(`ODS school ${schoolId} has no address to change`)
  address[field] = nextValue(field, address[field] ?? '', runSuffix)

  ensureOk(
    'update school',
    await guard('update school', () =>
      request.put(url, {
        headers: { ...headers, 'If-Match': current.headers()['etag'] ?? '' },
        data: body,
      }),
    ),
  )
}
