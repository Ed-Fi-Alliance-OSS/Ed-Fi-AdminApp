import './modes/dev';

process.env['NODE_CONFIG_DIR'] = './packages/api/config';

import './utils/checkEnv';

import { formErrFromValidator } from '@edanalytics/utils';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import colors from 'colors/safe';
import * as config from 'config';
import * as pgSession from 'connect-pg-simple';
import * as mssqlSession from 'connect-mssql-v2';
import { json } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as expressSession from 'express-session';
import { writeFileSync } from 'fs';
import passport from 'passport';
import { Client } from 'pg';
import * as sql from 'mssql';
import { AppModule } from './app/app.module';
import { CustomHttpException } from './utils/customExceptions';
import { AggregateErrorHandler } from './app/aggregate-error-handler';
import { AggregateErrorFilter } from './app/aggregate-error.filter';
import axios from 'axios';
import https from 'https';

const FIVE_SECONDS_IN_SECONDS = 5;
const FIVE_SECONDS_IN_MILLISECONDS = 5000;
const TWO_HOURS_IN_SECONDS = 60 * 60 * 2;

async function createMssqlConfig(): Promise<sql.config> {
  const mssqlConnectionStr = await config.DB_CONNECTION_STRING;
  const urlParts = new URL(mssqlConnectionStr);
  return {
    server: urlParts.hostname,
    port: parseInt(urlParts.port) || 1433,
    database: urlParts.pathname.slice(1),
    user: urlParts.username,
    password: urlParts.password,
    options: {
      encrypt: config.DB_SSL,
      trustServerCertificate: config.DB_TRUST_CERTIFICATE,
    },
    connectionTimeout: FIVE_SECONDS_IN_SECONDS, // this might be to aggressive
  };
}

async function createMssqlConnection(mssqlConfig?: sql.config): Promise<sql.ConnectionPool> {
  mssqlConfig = mssqlConfig || (await createMssqlConfig());
  const pool = new sql.ConnectionPool(mssqlConfig);
  return await pool.connect();
}

async function checkDatabaseAvailability(): Promise<void> {
  const healthCheckQuery = 'SELECT 1';
  try {
    Logger.log('Checking database availability before starting API...');

    if (config.DB_ENGINE === 'mssql') {
      const pool = await createMssqlConnection();
      try {
        await pool.request().query(healthCheckQuery);
      } finally {
        await pool.close();
      }
    } else {
      const pgConnectionStr = await config.DB_CONNECTION_STRING;
      const pgClient = new Client({
        connectionString: pgConnectionStr,
        connectionTimeoutMillis: FIVE_SECONDS_IN_MILLISECONDS,
      });

      await pgClient.connect();
      await pgClient.query(healthCheckQuery);
      await pgClient.end();
    }

    Logger.log('Database is available - proceeding with API startup');
  } catch (error) {
    // Handle AggregateError during startup
    const errorAnalysis = AggregateErrorHandler.handle(error);

    Logger.error('Database is not available - API startup aborted');
    Logger.error(`Database connection error: ${errorAnalysis.safeMessage}`);

    if (AggregateErrorHandler.isAggregateError(error)) {
      const allMessages = AggregateErrorHandler.extractAllMessages(error);
      Logger.error(`Individual AggregateError messages: ${allMessages.join(', ')}`);
    }

    Logger.error('Please ensure the database service is running and accessible');
    process.exit(1); // Exit with error code
  }
}

async function setupDatabaseSession(connectionStr: string, engine: string) {
  try {
    if (engine === 'mssql') {
      const table = 'sessions';

      const mssqlConfig = await createMssqlConfig();

      const pool = await createMssqlConnection();
      try {
        await pool.query(`IF (OBJECT_ID('${table}') IS NOT NULL) CREATE TABLE ${table};`);
      } finally {
        await pool.close();
      }

      Logger.log('Using MSSQL session store');
      return new mssqlSession.default(mssqlConfig, {
        table,
        ttl: TWO_HOURS_IN_SECONDS,
      });
    } else {
      // PostgreSQL setup (existing logic)
      const pgClient = new Client({ connectionString: connectionStr });
      await pgClient.connect();
      const existingSchema = await pgClient.query(
        "select schema_name from information_schema.schemata where schema_name = 'appsession'"
      );
      if (existingSchema.rowCount === 0) await pgClient.query('create schema appsession');
      await pgClient.end();

      Logger.log('Using PostgreSQL session store');
      return new (pgSession.default(expressSession.default))({
        createTableIfMissing: true,
        conString: connectionStr,
        schemaName: 'appsession',
        ttl: TWO_HOURS_IN_SECONDS,
      });
    }
  } catch (error) {
    Logger.warn(`Database unavailable for sessions, using memory store: ${error.message}`);
    // Database unavailable, use memory store (note: sessions won't persist across restarts)
    return undefined; // Use default memory store
  }
}

async function bootstrap() {
  // Check database availability first - exit if not available
  await checkDatabaseAvailability();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Optimize response headers for security
  app.disable('x-powered-by');
  app.use(function (_, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'deny');
    next();
  });

  const globalPrefix = 'api';
  await config.DB_ENCRYPTION_SECRET;

  const connectionStr = await config.DB_CONNECTION_STRING;
  const engine = (config as any).DB_ENGINE || 'pgsql';

  const sessionStore = await setupDatabaseSession(connectionStr, engine);

  app.use(json({ limit: '512kb' }));
  app.use(
    expressSession.default({
      store: sessionStore,
      // cryptographic signing is not necessary here. expressSession is very generic and there are other ways of using it for which signing is important.
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: 'auto' },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.setGlobalPrefix(globalPrefix);

  // Add global exception filter for AggregateError handling
  app.useGlobalFilters(new AggregateErrorFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (validationErrors = []) => {
        return new CustomHttpException({
          type: 'ValidationError',
          title: 'Invalid submission.',
          data: { errors: formErrFromValidator(validationErrors) },
        });
      },
    })
  );
  app.enableCors({ origin: config.FE_URL, credentials: true });
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    })
  );
  const port = config.API_PORT;
  if (config.OPEN_API) {
    if (process.env.NODE_ENV === 'production') {
      Logger.warn(
        colors.yellow('Swagger UI is disabled in production environment for security reasons.')
      );
    } else {
      const swaggerConfig = new DocumentBuilder()
        .setTitle(config.OPENAPI_TITLE)
        .setDescription(config.OPENAPI_DESCRIPTION)
        .setVersion('1.0')
        .build();
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api', app, document);
      writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
      Logger.verbose(`OpenAPI spec available at ${config.MY_URL_API_PATH} or file:./swagger.json`);
    }
  }
  await app.listen(port);
  if (config.FE_URL.includes('localhost')) {
    Logger.warn(
      `Setting up cors for requests from ${colors.cyan(config.FE_URL)}${colors.yellow(
        '. Requests from'
      )} ${colors.cyan('http://127.0.0.1')} ${colors.yellow('will fail.')}`
    );
  }
  if (config.FE_URL.includes('127.0.0.1')) {
    Logger.warn(
      `Setting up cors for requests from ${colors.cyan(config.FE_URL)}${colors.yellow(
        '. Requests from'
      )} ${colors.cyan('http://localhost')} ${colors.yellow('will fail.')}`
    );
  }

  // Not sure if this is the best way to disable SSL verification, but it is necessary for local development
  if (config.FE_URL.includes('localhost')) {
    axios.defaults.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    Logger.warn(
      colors.yellow(
        'SSL verification is disabled for local development. Do not use this in production!'
      )
    );
  }
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);

  // Set up global error handlers for AggregateError and other unhandled errors
  process.on('uncaughtException', (error) => {
    const errorAnalysis = AggregateErrorHandler.handle(error);
    Logger.error(`Uncaught Exception: ${errorAnalysis.safeMessage}`);

    if (AggregateErrorHandler.isAggregateError(error)) {
      const allMessages = AggregateErrorHandler.extractAllMessages(error);
      Logger.error(`AggregateError details: ${allMessages.join(', ')}`);
    }

    // Don't exit the process for database-related AggregateErrors as they're expected during DB downtime
    if (!errorAnalysis.isDatabaseRelated) {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    const errorAnalysis = AggregateErrorHandler.handle(reason);
    Logger.error(`Unhandled Rejection at: ${promise}, reason: ${errorAnalysis.safeMessage}`);

    if (AggregateErrorHandler.isAggregateError(reason)) {
      const allMessages = AggregateErrorHandler.extractAllMessages(reason);
      Logger.error(`AggregateError details: ${allMessages.join(', ')}`);
    }

    // Don't exit the process for database-related AggregateErrors
    if (!errorAnalysis.isDatabaseRelated) {
      process.exit(1);
    }
  });
}

bootstrap();
