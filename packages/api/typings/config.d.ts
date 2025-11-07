declare module 'config' {
  export interface IDbSecret {
    DB_HOST: string;
    DB_PORT: number;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
  }

  export interface IDbEncryptionSecret {
    KEY: string;
    IV: string;
  }

  export interface IAuth0Secret {
    ISSUER?: string;
    MACHINE_AUDIENCE?: string;
    CLIENT_ID?: string;
    CLIENT_SECRET?: string;
  }

  interface IConfig {
    OPEN_API: boolean;
    AWS_DB_SECRET?: string | undefined;
    DB_SECRET_VALUE: never;
    /**
     * Format: `postgres://username@host:port/db?password=password&sslmode=ssl`
     */
    DB_CONNECTION_STRING: string | Promise<string>;

    /** Serialized JSON array of "query" | "schema" | "error" | "warn" | "info" | "log" | "migration" */
    TYPEORM_LOGGING: string | undefined;

    /** Number of retry attempts for TypeORM database connections */
    TYPEORM_RETRY_ATTEMPTS: number;

    /** Delay between retry attempts in milliseconds */
    TYPEORM_RETRY_DELAY: number;

    AWS_DB_ENCRYPTION_SECRET?: string | undefined;
    DB_ENCRYPTION_SECRET_VALUE: never;
    DB_ENCRYPTION_SECRET: IDbEncryptionSecret | Promise<IDbEncryptionSecret>;

    AWS_REGION?: string | undefined;
    DB_ENGINE: 'mssql' | 'pgsql';
    isUsingPostgres: boolean;
    isUsingMssql: boolean;
    DB_SSL: boolean;
    DB_TRUST_CERTIFICATE: boolean;
    DB_RUN_MIGRATIONS: boolean;
    DB_SYNCHRONIZE: boolean;
    FE_URL: string;
    MY_URL: string;
    USE_YOPASS: boolean;
    YOPASS_URL: string;
    API_PORT: number;
    SB_SYNC_CRON: string;

    SAMPLE_OIDC_CONFIG?: {
      issuer: string;
      clientSecret: string;
      clientId: string;
      scope: string;
    };

    ADMIN_USERNAME?: string | undefined;

    CODE_ENV: string;

    // over-arching application to access auth0 management API
    AUTH0_CONFIG_SECRET: IAuth0Secret | Promise<IAuth0Secret>;

    WHITELISTED_REDIRECTS: string[];
    MY_URL_API_PATH: string;
    OPENAPI_TITLE: string;
    OPENAPI_DESCRIPTION: string;
    EDFI_URLS_TIMEOUT_MS: number;

    RATE_LIMIT_TTL: number; // The time to live in milliseconds
    RATE_LIMIT_LIMIT: number; // The maximum number of requests within the ttl

    USE_PKCE: boolean;
  }

  const config: IConfig;
  config.prototype.isUsingMssql = (this: IConfig): boolean => this.engine == "mssql";
  config.prototype.isUsingPostgres = (this: IConfig): boolean => this.engine == "pgsql";

  export = config;
}
