# Configuring Alternate OpenID Connect Providers

## Goal

This guide explains how to configure **Microsoft Entra ID** (formerly Azure
Active Directory) or **Google Workspace** as an OpenID Connect (OIDC) identity
provider for the Ed-Fi Admin App, replacing or supplementing the default
Keycloak instance.

## Why Use an Alternate Provider?

The Ed-Fi Admin App ships with Keycloak as its default OIDC provider because it
is open-source, self-hosted, and straightforward to bundle in a Docker Compose
deployment. However, many organizations already manage user identities through a
cloud provider:

- **Microsoft Entra ID** — common in school districts and state agencies that
  use Microsoft 365.
- **Google Workspace** — common in districts that standardize on Google
  Classroom and Google Admin.

Using your existing identity provider eliminates duplicate user accounts,
leverages your organization's existing multi-factor authentication policies, and
simplifies onboarding and offboarding of staff.

## How the Admin App OIDC Integration Works

Before configuring an alternate provider it is helpful to understand the current
architecture. The Admin App stores OIDC provider configurations in a database
table (`oidc`) with the following columns:

| Column         | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `id`           | Auto-incrementing primary key (referenced as the **OIDC ID**)   |
| `issuer`       | The OIDC issuer URL (e.g. `https://login.microsoftonline.com/{tenant-id}/v2.0`) |
| `clientId`     | The OAuth 2.0 client/application ID registered with the provider |
| `clientSecret` | The OAuth 2.0 client secret                                     |
| `scope`        | Space-separated OIDC scopes (e.g. `openid profile email`)       |

On startup the API server reads every row from this table, discovers the
provider's metadata via `{issuer}/.well-known/openid-configuration`, and
registers a Passport strategy for each one (`oidc-{id}`). The frontend
redirects the user to `/auth/login/{oidcId}`, which triggers the corresponding
Passport strategy and initiates the standard Authorization Code flow with PKCE.

After the provider authenticates the user, it redirects back to
`/auth/callback/{oidcId}`. The API validates the token, looks up the user by
email address in its own database, and creates a session.

> **Key point:** The Admin App identifies users by the `email` claim returned by
> the identity provider. The email address must match an existing user record in
> the Admin App database.

---

## Configuring Microsoft Entra ID

### 1. Register an Application in the Azure Portal

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**.
3. Fill in the form:
   - **Name:** `Ed-Fi Admin App` (or a name meaningful to your organization).
   - **Supported account types:** Choose the option that matches your tenant
     (typically *Accounts in this organizational directory only*).
   - **Redirect URI:**
     - Platform: **Web**
     - URI: `https://<YOUR_DOMAIN>/adminapp-api/api/auth/callback/<OIDC_ID>`

     Replace `<YOUR_DOMAIN>` with the public hostname of your Admin App
     deployment. The `<OIDC_ID>` value is the `id` column that will be assigned
     to this provider in the database (typically `1` if this is the only
     provider, or the next available integer if you already have other OIDC
     records).

4. Click **Register**.

### 2. Record the Application (Client) ID and Tenant ID

After registration, note the following values from the **Overview** page:

- **Application (client) ID** — this is the `clientId`.
- **Directory (tenant) ID** — used to construct the `issuer` URL.

The issuer URL for Entra ID v2.0 is:

```
https://login.microsoftonline.com/<TENANT_ID>/v2.0
```

### 3. Create a Client Secret

1. Go to **Certificates & secrets** → **Client secrets** → **New client
   secret**.
2. Add a description (e.g. `Ed-Fi Admin App`) and choose an expiration period.
3. Click **Add** and immediately copy the **Value** — this is the
   `clientSecret`. It is only shown once.

### 4. Configure API Permissions

1. Go to **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Delegated permissions**.
2. Add the following permissions:
   - `openid`
   - `profile`
   - `email`
3. Click **Grant admin consent for \<your organization\>** if required by your
   tenant policies.

### 5. Configure Token Claims

Entra returns the user's email in the `email` claim by default for users with a
mailbox. To ensure the `email` claim is always present:

1. Go to **Token configuration** → **Add optional claim**.
2. Select **ID** token type.
3. Check `email` and click **Add**.

### Summary of Entra Values

| Admin App Field | Entra Value                                                 |
| --------------- | ----------------------------------------------------------- |
| `issuer`        | `https://login.microsoftonline.com/<TENANT_ID>/v2.0`       |
| `clientId`      | Application (client) ID from the Overview page              |
| `clientSecret`  | Client secret value from Certificates & secrets             |
| `scope`         | `openid profile email`                                      |

---

## Configuring Google Workspace

### 1. Create OAuth 2.0 Credentials in the Google Cloud Console

1. Sign in to the [Google Cloud Console](https://console.cloud.google.com).
2. Select or create a project for your organization.
3. Navigate to **APIs & Services** → **Credentials** → **Create Credentials** →
   **OAuth client ID**.
4. If prompted, configure the **OAuth consent screen** first:
   - **User type:** Internal (limits login to your Google Workspace domain).
   - Fill in the required fields (app name, support email).
   - Under **Scopes**, add `openid`, `email`, and `profile`.
   - Save and return to **Credentials**.
5. Select **Application type:** **Web application**.
6. Set a **Name** (e.g. `Ed-Fi Admin App`).
7. Under **Authorized redirect URIs**, add:

   ```
   https://<YOUR_DOMAIN>/adminapp-api/api/auth/callback/<OIDC_ID>
   ```

8. Click **Create**.

### 2. Record the Client ID and Client Secret

After creation, Google displays the **Client ID** and **Client Secret**. Copy
both values immediately.

### 3. Verify Domain Ownership (if required)

For production deployments, Google may require you to verify ownership of the
redirect URI domain. Follow the instructions under **APIs & Services** → **Domain
verification** if prompted.

### Summary of Google Values

| Admin App Field | Google Value                                       |
| --------------- | -------------------------------------------------- |
| `issuer`        | `https://accounts.google.com`                      |
| `clientId`      | Client ID from the OAuth Credentials page          |
| `clientSecret`  | Client secret from the OAuth Credentials page      |
| `scope`         | `openid profile email`                             |

---

## Updating the Admin App Backend

### Option A — Seed via Configuration (Recommended for New Deployments)

If you are deploying the Admin App for the first time, the easiest approach is
to set the `SAMPLE_OIDC_CONFIG` environment variable **before the database
migrations run**. The seeding migration inserts this configuration into the
`oidc` table automatically when the table is empty.

Set the environment variable as a JSON string:

```bash
# Microsoft Entra example
export SAMPLE_OIDC_CONFIG='{"issuer":"https://login.microsoftonline.com/<TENANT_ID>/v2.0","clientId":"<CLIENT_ID>","clientSecret":"<CLIENT_SECRET>","scope":"openid profile email"}'

# Google Workspace example
export SAMPLE_OIDC_CONFIG='{"issuer":"https://accounts.google.com","clientId":"<CLIENT_ID>","clientSecret":"<CLIENT_SECRET>","scope":"openid profile email"}'
```

Alternatively, if you use a `config/local.js` file for your NestJS
configuration:

```js
module.exports = {
  // ... other settings
  SAMPLE_OIDC_CONFIG: {
    issuer: 'https://login.microsoftonline.com/<TENANT_ID>/v2.0', // or https://accounts.google.com
    clientId: '<CLIENT_ID>',
    clientSecret: '<CLIENT_SECRET>',
    scope: 'openid profile email',
  },
};
```

### Option B — Insert Directly into the Database (Existing Deployments)

If the Admin App database already exists, insert the OIDC record directly.

#### PostgreSQL

```sql
INSERT INTO public.oidc (issuer, "clientId", "clientSecret", scope)
VALUES (
  'https://login.microsoftonline.com/<TENANT_ID>/v2.0',  -- or 'https://accounts.google.com'
  '<CLIENT_ID>',
  '<CLIENT_SECRET>',
  'openid profile email'
);
```

Verify the record and note the generated `id`:

```sql
SELECT * FROM public.oidc;
```

#### Microsoft SQL Server

```sql
INSERT INTO [oidc] ([issuer], [clientId], [clientSecret], [scope])
VALUES (
  'https://login.microsoftonline.com/<TENANT_ID>/v2.0',  -- or 'https://accounts.google.com'
  '<CLIENT_ID>',
  '<CLIENT_SECRET>',
  'openid profile email'
);
```

#### Using the Helper Script (Docker Compose PostgreSQL)

If you are running the Docker Compose stack with PostgreSQL, you can use the
bundled helper script:

```powershell
./compose/settings/populate-oidc.ps1 `
  -ClientId "<CLIENT_ID>" `
  -ClientSecret "<CLIENT_SECRET>" `
  -Issuer "https://login.microsoftonline.com/<TENANT_ID>/v2.0"
```

### Provisioning Users

After configuring the OIDC provider, every user who will log in must have a
matching record in the Admin App `user` table. The `username` column must be set
to the **email address** that the identity provider returns in the `email` claim.

```sql
-- PostgreSQL
INSERT INTO public."user" (username, "roleId", "isActive")
VALUES ('jane.doe@example.com', 1, true);

-- SQL Server
INSERT INTO [user] ([username], [roleId], [isActive])
VALUES ('jane.doe@example.com', 1, 1);
```

> **Tip:** The `roleId` should correspond to a valid role in the `role` table.
> Check your existing roles with `SELECT * FROM role;`.

### Replacing Keycloak Entirely

If you no longer need Keycloak you can:

1. Remove or stop the Keycloak container in your Docker Compose configuration.
2. Delete the old Keycloak-based OIDC record from the `oidc` table if desired.
3. Update the `VITE_IDP_ACCOUNT_URL` frontend variable (see below) to point to
   your new provider's account management page, or remove it if you do not want
   to link to one.

### Logout Behavior

The current logout implementation constructs a Keycloak-specific logout URL
(`{issuer}/protocol/openid-connect/logout`). When using Entra or Google:

- **Microsoft Entra** supports the standard OIDC
  `end_session_endpoint` which is advertised in the discovery document. The
  Keycloak-formatted URL will not work. The Admin App will fall back to
  destroying the local session and redirecting the user to the frontend.
- **Google Workspace** does not provide an `end_session_endpoint`. The Admin
  App will destroy the local session and redirect to the frontend.

In both cases the user's local session is fully destroyed. The provider-side
session (Microsoft or Google) remains active, which means the user stays
signed in to other applications using that identity. This is standard behavior
for most OIDC relying parties.

> **Note:** If your organization requires full single-logout (SLO) with Entra
> or Google, the logout controller would need to be extended to read the
> `end_session_endpoint` from the discovered OIDC metadata instead of
> constructing a Keycloak-specific URL. This is a potential future enhancement.

---

## Configuring the Admin App Frontend

The frontend needs to know which OIDC provider record to use when redirecting
users to the login endpoint. This is controlled by the `VITE_OIDC_ID`
environment variable.

### Environment Variables

Update the following variables in your `.env` file (for Docker Compose) or in
`packages/fe/.env.local` (for local development):

```env
# The 'id' column from the oidc table for your chosen provider
VITE_OIDC_ID=1

# (Optional) Link to the identity provider's account management page.
# For Entra:
VITE_IDP_ACCOUNT_URL=https://myaccount.microsoft.com
# For Google:
VITE_IDP_ACCOUNT_URL=https://myaccount.google.com
```

### How It Works

- On login, the React application redirects the browser to
  `{API_URL}/auth/login/{VITE_OIDC_ID}`.
- The backend looks up the OIDC configuration with matching `id` from the
  database and initiates the authorization code flow with the configured
  provider.
- If the `VITE_OIDC_ID` does not match any database record, the user sees a
  *Not Found* error.

### Verifying the Configuration

After setting the environment variables and starting the application:

1. Open the Admin App in your browser.
2. You should be redirected to your identity provider's login page (Microsoft
   or Google) instead of Keycloak.
3. After authenticating, you should be redirected back to the Admin App
   dashboard.
4. If you see an *Unauthenticated* error, check that:
   - The user's email address exists in the Admin App `user` table.
   - The user has a valid `roleId` assigned.
   - The redirect URI in the provider's configuration matches exactly
     (including trailing slashes and path).

---

## Security Concerns and Mitigations

### Client Secret Storage

The OIDC `clientSecret` is stored in the `oidc` database table. Ensure that:

- The database is not publicly accessible.
- Database credentials are rotated on a regular schedule.
- If available, use the Admin App's built-in encryption-at-rest feature for
  sensitive columns (configured via `DB_ENCRYPTION_SECRET`).
- In cloud deployments, consider storing the secret in a service such as AWS
  Secrets Manager or Azure Key Vault and injecting it at runtime.

### Redirect URI Validation

The Admin App validates redirect URLs against a whitelist
(`WHITELISTED_REDIRECTS` in the API configuration). Only the configured frontend
URL is allowed. This prevents open-redirect attacks where an attacker could
craft a login URL that redirects the user to a malicious site after
authentication.

Make sure `WHITELISTED_REDIRECTS` only contains URLs you control.

### PKCE (Proof Key for Code Exchange)

PKCE is enabled by default (`USE_PKCE: true`). This protects the authorization
code flow against interception attacks and is recommended by the OAuth 2.0
Security Best Current Practice (RFC 9700). Both Microsoft Entra and Google
support PKCE — do not disable it unless you have a specific reason and
understand the risk.

### Token and Session Lifetime

- **Provider session:** Controlled by your Entra or Google tenant policies.
  Admin App has no control over this.
- **Admin App session:** Controlled by the Express session configuration in
  `main.ts`. Ensure the session timeout is appropriate for your security
  requirements.
- **Refresh tokens:** The Admin App does not currently use refresh tokens. When
  the session expires the user is redirected to log in again.

### Scope of Access

Request only the minimum scopes needed: `openid profile email`. Do not request
additional scopes (such as `User.Read` in Microsoft Graph) unless you have a
specific use case, to follow the principle of least privilege.

### Multi-Factor Authentication (MFA)

MFA policies are enforced at the identity provider level:

- **Microsoft Entra:** Configure Conditional Access policies in the Azure
  Portal to require MFA for the Ed-Fi Admin App.
- **Google Workspace:** Enable 2-Step Verification in the Google Admin console.

The Admin App itself does not enforce MFA — it relies entirely on the upstream
provider.

### Secret Rotation

Both Entra and Google client secrets have configurable expiration periods. Set
a calendar reminder to rotate secrets before they expire. When rotating:

1. Create a new secret in the provider's console.
2. Update the `clientSecret` value in the `oidc` database table.
3. Restart the Admin App API so it re-discovers the updated configuration.
4. Delete the old secret from the provider's console.

### HTTPS Requirements

Always serve the Admin App over HTTPS in production. Both Entra and Google
require HTTPS redirect URIs (except for `localhost` during development). Set
`SSL_VERIFICATION: true` in production to enable TLS certificate verification
for outbound requests from the API.
