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

    SAMPLE_SBE_CONFIG?: {
      adminApiUrl: string;
      adminApiKey: string;
      adminApiSecret: string;
      sbeMetaUrl: string;
      sbeMetaKey: string;
      sbeMetaSecret: string;
    };
    SAMPLE_OIDC_CONFIG?: {
      issuer: string;
      clientSecret: string;
      clientId: string;
      scope: string;
    };
    SAMPLE_APP_LAUNCHER_CONFIG?: {
      url: string;
      poolId: string;
      clientId: string;
    };

    SEED_BASIC: string;
    SEED_SAMPLE_CONFIG: string;
    SEED_DEMO_DATA: string;
  }

  const config: IConfig;
  export = config;
}
