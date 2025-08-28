# Docker Compose Usage

## About

This directory includes a Docker Compose file for starting a collection of services needed for running and testing Starting Blocks Admin App. It includes a deployment of ODS/API 7.3 and Admin API 2.2 in multi-tenant mode, and a deployment of ODS/API 6.2 and Admin API 1.4 in district-specific mode.

### Containers for SBAA Support

```mermaid
graph TD
  sbaa-db
  pgadmin4
  keycloak
  memcached
  yopass --> memcached
```

- **sbaa-db**: PostgreSQL database instance for the SBAA API.
- **pgadmin4**: Standard PGAdmin4 deploy, preconfigured with links to the various PostgreSQL databases.
- **keycloak**: For user authentication.
- **yopass**: A web application for sharing one-time encrypted secrets, such as a ODS/API `client_secret`.
- **memcached**: Database supporting Yopass.

### Containers for ODS/API 7.3

```mermaid
graph TD
  v7-db-ods-tenant1
  v7-db-ods-tenant2
  v7-db-admin-tenant1 --> v7-db-ods-tenant1
  v7-db-admin-tenant2 --> v7-db-ods-tenant2
  v7-api --> v7-db-ods-tenant1
  v7-api --> v7-db-ods-tenant2
  v7-api --> v7-db-admin-tenant1
  v7-api --> v7-db-admin-tenant2
  v7-adminapi --> v7-db-admin-tenant1
  v7-adminapi --> v7-db-admin-tenant2
  v7-nginx --> v7-api
  v7-nginx --> v7-adminapi
```

- Includes two tenancies, each with own combination of "ODS" and "Admin" databases.
- There is only one ODS/API and one Admin API installation, supporting both tenants.
- **NGiNX** serves as a reverse proxy.

### Containers for ODS/API 6.2

```mermaid
graph TD
  v6-db-admin
  v6-edfi-ods-255901
  v6-edfi-ods-255902
  v6-api --> v6-db-admin
  v6-api --> v6-edfi-ods-255901
  v6-api --> v6-edfi-ods-255902
  v6-adminapi --> v6-db-admin
  v6-nginx --> v6-api
  v6-nginx --> v6-adminapi
```

Because this is district-specific mode, and not a multi-tenant application, both districts' setups and client credentials are in the same "Admin" database instance, even though the two districts have distinct "ODS" databases.

## Getting Started

> [!WARNING]
> For local usage, best to rely on Docker Desktop. Podman might work, but there are sufficient differences between the two that it is difficult to test and verify.

### Start Containers

There are two Docker Compose files: `docker-compose.yml` and `keycloak.yml`. This allows the developer to keep Keycloak's persistent volume while easily dropping and all other volumes, for quick reset of local development environments. Keycloak's volume can also be reset easily if desired.

1. Duplicate `.env.example` as `.env`; review the settings and customize if desired.
2. Create a self-signed certificate using script `ssl/generate-certificate.sh`, which will be used by the "gateway" container (NGiNX)
   1. TIP: Windows users can use WSL or Git-bash to run this.
3. If using PowerShell:
   - Run `up.ps1` to start all services
   - Run `down.ps1` to shut them down again; add `-v` to drop volumes; add `-Keycloak` to drop Keycloak's volume.
4. Else:

   - Be sure to create the `logs` directory before starting services
   - And create the external `sbaa-network`.

   ```shell
   mkdir logs > /dev/null
   docker network create sbaa-network --driver bridge
   ```

### Setup Keycloak

1. Open [Keycloak](http://localhost:8045).
2. Sign-in with the credentials from your `.env` file.
3. Create a new realm called `edfi`.
4. Create a new non-admin client:
   1. Click on Clients.
   2. Click the Import client button.
   3. Browse to load the file `keycloak_sbaa_client.json` from the `settings` directory.
   4. Save.
5. Create a new user in Keycloak.
   1. Default email address: `sbaa-admin@example.com`

> [!TIP]
> You can sign-in as the new user without generating a password: on the user page, click the `Action` drop down (upper right corner) and choose `Impersonate`.

### Setup Local Configuration for SBAA

In `packages/api/config`, copy `local.js-edfi` to create `local.js`.

- If you changed anything in your `.env` or `keycloak_sbaa_client.json`, then be sure to update those values in this file as well.
- Ensure that `ADMIN_USERNAME` matches the email address you used when creating a new user in Keycloak (above).

> [!NOTE]
> `local.js` should not be kept in source control.

In `packages/fe`, copy `.copyme.env.local` to create `.env`.

### Install Node Dependencies

```shell
npm i
```

See [Ed-Fi Developer's Guide](../docs/ed-fi-development.md) for troublshooting tips.

### Start the SBAA Services in Development Mode

If you are signed into Keycloak with the default `admin` user, then either impersonate the new user or sign out and sign-in as that user.

Run each application in separate terminal windows:

```shell
# Terminal 1
npm run start:api:dev

# Terminal 2
npm run start:fe:dev
```

To verify the API service is running, call the [Healthcheck endpoint](http://localhost:3333/api/healthcheck).

```http
GET http://localhost:3333/api/healthcheck
```

### Global Setup

If all went well, you can open [http://localhost:4200/](http://localhost:4200/) with your bootstrapped initial user. This will start you in "Global scope" mode for initial configuration.

In Global Scope, complete the following setup:

- **Environments** - ❌ our first Stumbling Block - this tries to connect to AWS. Will need to replace.
- **Teams** - create a Team, name it whatever you like. More detail to come.
- **Users** - ignore for now
- **Team Memberships** - try adding yourself to the new Team, with "Tenant Admin" access.
- **Roles** - assign all `team.sb-environment.edfi-tenant.profile` privileges to the "Tenant admin" and "Full ownership" roles
- **Ownerships** - won't be able to do anything until we figure out how to create an Environment outside of AWS.
- **Sync Queue** - ignore

### URLs

- [ODS/API 7.x](https://localhost:4443/v7-ods)
  - [Admin API 2.x](https://localhost:4443/v7-adminapi)
- [ODS/API 6.x](https://localhost:5443/v6-ods)
  - [Admin API 1.x](https://localhost:5443/v6-adminapi)
- [Keycloak](http://localhost:8045)
- [Yopass](http://localhost:8082)
- [PGAdmin4](http://localhost:5050)
- [SBAA API Swagger](http://localhost:3333/api/)
- [SBAA UI](http://localhost:4200/)

## Troubleshooting

### Unable to connect to OpenID Connect Provider

Did you change something about the OpenID Connect Provider configuration after first startup?

The initial API startup process copies the OIDC configuration from the configuration file into the database. Either find it in the DB and update manually, or simply shut down all services while dropping volumes, and startup again.
