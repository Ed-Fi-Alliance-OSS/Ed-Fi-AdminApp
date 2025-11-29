const defer = require('config/defer').deferConfig;
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Test secret retrieval locally if you want by adding creds to the client:
// credentials: {
//   accessKeyId: '',
//   secretAccessKey: '',
//   sessionToken: '',
// },
const makePgsqlConnectionString = (port, db, username, password, host, ssl) => {
  return `postgres://${username}@${host}:${port}/${db}?password=${password}&sslmode=${ssl}`;
};
module.exports = {
  get OPEN_API() {
    return this._OPEN_API === true || this._OPEN_API === 'true';
  },
  _OPEN_API: false,
  DB_RUN_MIGRATIONS: true,
  DB_SYNCHRONIZE: false,
  DB_ENGINE: 'pgsql', // Default to PostgreSQL, can be 'pgsql' or 'mssql'
  DB_TRUST_CERTIFICATE: false, // For MSSQL, whether to trust the server certificate
  API_PORT: 5000,
  // min hr day mo yr
  SB_SYNC_CRON: '0 2 * * *',
  TYPEORM_LOGGING: undefined,
  // TypeORM database resilience configuration
  TYPEORM_RETRY_ATTEMPTS: 3,
  TYPEORM_RETRY_DELAY: 3000,
  AUTH0_CONFIG_SECRET: defer(function () {
    if (this.AWS_AUTH0_CONFIG_SECRET) {
      return new Promise(async (r) => {
        const secretsClient = new SecretsManagerClient({
          region: this.AWS_REGION,
        });
        const secretValueRaw = await secretsClient.send(
          new GetSecretValueCommand({
            SecretId: this.AWS_AUTH0_CONFIG_SECRET,
          })
        );
        if (secretValueRaw.SecretString === undefined) {
          throw new Error('No client config values defined for auth0 when requesting secrets');
        }

        const secret = JSON.parse(secretValueRaw.SecretString);
        r({
          ISSUER: secret.ISSUER,
          CLIENT_ID: secret.CLIENT_ID,
          CLIENT_SECRET: secret.CLIENT_SECRET,
          MACHINE_AUDIENCE: secret.MACHINE_AUDIENCE,
        });
      });
    } else {
      return { ...this.AUTH0_CONFIG_SECRET_VALUE };
    }
  }),
  DB_CONNECTION_STRING: defer(function () {
    const ssl = this.DB_SSL ? 'require' : 'disable';
    const engine = this.DB_ENGINE || 'pgsql';
    if (this.AWS_DB_SECRET) {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (r) => {
        const secretsClient = new SecretsManagerClient({
          region: this.AWS_REGION,
        });
        const secretValueRaw = await secretsClient.send(
          new GetSecretValueCommand({
            SecretId: this.AWS_DB_SECRET,
          })
        );

        if (secretValueRaw.SecretString === undefined) {
          throw new Error(`No connection values defined for ${engine} when requesting secrets`);
        }

        const secret = JSON.parse(secretValueRaw.SecretString);
        const { username, password, host, port, dbname } = secret;
        r(makePgsqlConnectionString(port, dbname, username, password, host, ssl, engine));
      });
    } else {
      // locally we expect plain (non-promise) values. Especially the TypeORM migration CLI.
      if (engine === 'mssql') {
        const {
          MSSQL_DB_USERNAME,
          MSSQL_DB_PASSWORD,
          MSSQL_DB_HOST,
          MSSQL_DB_PORT,
          MSSQL_DB_DATABASE,
        } = this.DB_SECRET_VALUE;
        const connString = `mssql://${MSSQL_DB_USERNAME}:${MSSQL_DB_PASSWORD}@${MSSQL_DB_HOST}:${MSSQL_DB_PORT}/${MSSQL_DB_DATABASE}?encrypt=${this.DB_SSL}&trustServerCertificate=${this.DB_TRUST_CERTIFICATE}`;

        return connString;
      }

      const { DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = this.DB_SECRET_VALUE;
      return makePgsqlConnectionString(
        DB_PORT,
        DB_DATABASE,
        DB_USERNAME,
        DB_PASSWORD,
        DB_HOST,
        ssl
      );
    }
  }),
  DB_ENCRYPTION_SECRET: defer(function () {
    let out;
    if (this.AWS_DB_ENCRYPTION_SECRET) {
      // eslint-disable-next-line no-async-promise-executor
      out = new Promise(async (r) => {
        const secretsClient = new SecretsManagerClient({
          region: this.AWS_REGION,
        });
        const secretValueRaw = await secretsClient.send(
          new GetSecretValueCommand({
            SecretId: this.AWS_DB_ENCRYPTION_SECRET,
          })
        );

        if (secretValueRaw.SecretString === undefined) {
          throw new Error('No client config values defined for OIDC when requesting secrets');
        }

        const secret = JSON.parse(secretValueRaw.SecretString);
        r({
          KEY: secret.KEY,
          IV: secret.IV,
        });
      });
      out.then((value) => {
        global.DB_SECRETS_ENCRYPTION = value;
      });
    } else {
      // locally we expect plain (non-promise) values. Especially the TypeORM migration CLI.
      out = { ...this.DB_ENCRYPTION_SECRET_VALUE };
      global.DB_SECRETS_ENCRYPTION = out;
    }
    return out;
  }),
  USE_YOPASS: false,
  WHITELISTED_REDIRECTS: [this.FE_URL],
  MY_URL: (string = ''),
  get MY_URL_API_PATH() {
    return this.MY_URL.endsWith('/api') ? this.MY_URL : `${this.MY_URL}/api`;
  },
  OPENAPI_TITLE: 'Starting Blocks Admin App',
  OPENAPI_DESCRIPTION: 'OpenAPI spec for the EA Starting Blocks admin application.',
  EDFI_URLS_TIMEOUT_MS: 5000, // 5 seconds

  // The time to live in milliseconds
  RATE_LIMIT_TTL: 60000,

  // The maximum number of requests within the ttl
  RATE_LIMIT_LIMIT: 100,

  USE_PKCE: true,

  // Set the _minimum_ log level. This uses NestJs logging, so the allowed values are: verbose, debug, log, warn, error, fatal
  LOG_LEVEL: 'log',
};
