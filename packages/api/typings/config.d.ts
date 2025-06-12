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

    AWS_DB_ENCRYPTION_SECRET?: string | undefined;
    DB_ENCRYPTION_SECRET_VALUE: never;
    DB_ENCRYPTION_SECRET: IDbEncryptionSecret | Promise<IDbEncryptionSecret>;

    AWS_REGION?: string | undefined;
    DB_SSL: boolean;
    DB_RUN_MIGRATIONS: boolean;
    DB_SYNCHRONIZE: boolean;
    FE_URL: string;
    MY_URL: string;
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
  }

  const config: IConfig;
  export = config;
}
