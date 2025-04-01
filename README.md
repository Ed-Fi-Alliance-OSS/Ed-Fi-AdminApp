# Starting Blocks Admin App

- [Starting Blocks Admin App](#starting-blocks-admin-app)
  - [Running locally](#running-locally)
    - [Environment](#environment)
    - [External dependencies](#external-dependencies)
    - [Send it](#send-it)
  - [Possible issues](#possible-issues)
  - [Using a machine user](#using-a-machine-user)
  - [Random things](#random-things)
  - [Architecture overview](#architecture-overview)

## Running locally

Once you've followed the setup instructions below, you can do the following in two different terminal windows

1. Run `./run-docker.sh`
   1. This currently assumes that you have repo folders named `startingblocks_admin_app` and `keycloak_local_idp_se` in the same folder named `code`. I am working on making this configurable.
2. Run `npm start`
   1. This will run both `api` and `fe` in the same terminal window. If you wish to keep the output separate, run `npm run start:api:dev` and `npm run start:fe:dev` in separate terminals instead.

### Environment

Duplicate the `.copyme` files at the following locations, removing that part of the name:

- [packages/fe/.copyme.env.local](./packages/fe/.copyme.env.local)
- [packages/api/config/local-development.js.copyme](./packages/api/config/local-development.js.copyme)

  - Generate for yourself a new encryption key to be used in the config file above. This is used to encrypt (at rest) the Ed-Fi Admin API credentials.

    ```shell
    node -e "console.log('KEY: '+ require('crypto').randomBytes(32).toString('hex'))"
    ```

  - Note the `ADMIN_USERNAME` option which you can use to avoid seeding a user in Postgres directly. This should match something you either have or will create in Keycloak.

Go to [AWS](https://edanalytics.awsapps.com/start#/). Under the `EA EdFi` account, log into a profile with command line or programmatic access. Notice the hint about `aws configure sso`. Do whatever option you want, but the goal is just to end up with the NodeJS AWS library able to log in in any of its totally standard ways. The simplest option is to go to the terminal where you will try to run the server, and paste and execute the first code block from the AWS login screen (`export AWS_ACCESS_KEY_ID=...`). Then when you start the server it will have those values available in the environment. Again, this is standard AWS stuff not particular to SBAA at all, so see other sources for more info.

### External dependencies

**Keycloak as an identity provider:**

1. Clone the [local IdP repo](https://github.com/edanalytics/keycloak_local_idp_se.git):
   ```
   git clone https://github.com/edanalytics/keycloak_local_idp_se.git
   ```
1. Copy the [sbaa-keycloak-config.local.yml](./sbaa-keycloak-config.local.yml) file from this repository into the `/config` folder of the IdP one. This new file adds a "Starting Blocks Admin App" identity client to the Realm set up by the default `config.yml` file that will already be there.
1. In the IdP repo, run `docker compose up`.
1. (optional) Go to [http://localhost:8080/realms/example/account](http://localhost:8080/realms/example/account) and log in with one of the credentials suggested by Keeper (teacher, principal, or admin). **_Or_**, go to http://localhost:8080/admin/master/console/#/example/users and impersonate one.

You now have a local identity provider running with a configuration that matches what's in the `SAMPLE_OIDC_CONFIG` variable you set up in the preceding section.

**VS Code extensions:**

1. Install the VS Code extensions recommended for this repository.

### Send it

1. Run `docker compose up` in this repo to start Postgres.
1. Run `npm i`
1. Find the `serve` _"Generate & run target"_ in the Nx Console extension, and use it to run the app (you may have to click the &#x21BB; button to the right of that heading in order to see `serve` appear):

   - API
   - FE

   _(Or run `npx nx run fe:serve` and `npx nx run api:serve` in two shells)_

1. Go to http://localhost:4200 and log in.
1. Start Storybook if you want with the Nx `storybook` target

## Possible issues

> - You can only log in if SBAA is successfully connected to some IdP. Check the `oidc` table and check your IdP.
> - You can only log in if the database has been populated with a user and that user is active and has a role.
> - There's not much to do until the app has some data in it.
> - CORS: You can access the app either via hostname (`localhost`) or IP (`127.0.0.1`), but your `FE_URL` config value will only match one of those. Make sure you don't wind up putting one in your config file but the other in your browser.

## Using a machine user

1. Login with the machine user via auth0 directly (a curl example is below)

```
curl \
--header "Content-Type: application/json" \
--request POST \
--data '{ "audience": "AUDIENCE", "grant_type": "client_credentials", "client_id": "CLIENT_ID", "client_secret": "CLIENT_SECRET" }' \
'SOME_AUTH0_URL'
```

2. This will give you a bearer token
3. Call an endpoint with the token (a curl example is below)
   1. This token is decoded to retrieve a client ID
   2. The client ID is used to find the relevant machine user

```
curl \
--header 'authorization: Bearer BEARER_TOKEN' \
--request GET \
'SBAA_URL/api/auth/me'
```

## Random things

- You'll get a file called `/sbaa-swagger.json` generated when the server starts if you have that enabled in your config variables. That's the OpenAPI spec served at the `/api` route.
- You'll get a file called `/stats.html` generated when the front-end builds in production mode. That's the output of a bundle analyzer to help with getting rid of dependency cruft that the front end has to (slowly) load.
- If you don't have the needed AWS access, the app can still run. It just won't be able to do the particular operations that try to execute lambdas.

## Architecture overview

An overview of the architecture can be found [here](docs/architecture.md)
