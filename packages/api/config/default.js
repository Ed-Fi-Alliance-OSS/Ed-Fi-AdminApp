const defer = require('config/defer').deferConfig;
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Test secret retrieval locally if you want by adding creds to the client:
// credentials: {
//   accessKeyId: '',
//   secretAccessKey: '',
//   sessionToken: '',
// },
const makeConnectionString = (port, db, username, password, host, ssl) =>
  `postgres://${username}@${host}:${port}/${db}?password=${password}&sslmode=${ssl}`;
module.exports = {
  DB_RUN_MIGRATIONS: true,
  DB_SYNCHRONIZE: false,
  API_PORT: 5000,
  TYPEORM_LOGGING: undefined,
  DB_CONNECTION_STRING: defer(function () {
    const ssl = this.DB_SSL ? 'require' : 'disable';
    if (this.AWS_DB_SECRET) {
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
          throw new Error('No connection values defined for postgres when requesting secrets');
        }

        const secret = JSON.parse(secretValueRaw.SecretString);
        const { username, password, host, port, dbname } = secret;
        r(makeConnectionString(port, dbname, username, password, host, ssl));
      });
    } else {
      const { DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = this.DB_SECRET_VALUE;
      return makeConnectionString(DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_HOST, ssl);
    }
  }),
  DB_ENCRYPTION_SECRET: defer(function () {
    let out;
    if (this.AWS_DB_ENCRYPTION_SECRET) {
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
      out = { ...this.DB_ENCRYPTION_SECRET_VALUE };
      global.DB_SECRETS_ENCRYPTION = out;
    }
    return out;
  }),
};
