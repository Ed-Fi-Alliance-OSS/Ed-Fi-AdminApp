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
import { json } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as expressSession from 'express-session';
import { writeFileSync } from 'fs';
import passport from 'passport';
import { Client } from 'pg';
import { AppModule } from './app/app.module';
import { CustomHttpException } from './utils/customExceptions';
import axios from 'axios';
import https from 'https';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Optimize response headers for security
  app.disable('x-powered-by');
  app.use(function(_, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'deny');
    next();
  });

  const globalPrefix = 'api';
  await config.DB_ENCRYPTION_SECRET;
  const pgConnectionStr = await config.DB_CONNECTION_STRING;
  const pgClient = new Client({ connectionString: pgConnectionStr });
  await pgClient.connect();
  const existingSchema = await pgClient.query(
    "select schema_name from information_schema.schemata where schema_name = 'appsession'"
  );
  if (existingSchema.rowCount === 0) await pgClient.query('create schema appsession');

  app.use(json({ limit: '512kb' }));
  app.use(
    expressSession.default({
      store: new (pgSession.default(expressSession.default))({
        createTableIfMissing: true,
        conString: pgConnectionStr,
        schemaName: 'appsession',
        ttl: 60 * 60 * 2, // 2hr (if omitted defaults to 24hr)
      }),
      // cryptographic signing is not necessary here. expressSession is very generic and there are other ways of using it for which signing is important.
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: 'auto' },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
  app.setGlobalPrefix(globalPrefix);
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
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Starting Blocks Admin App')
      .setDescription('OpenAPI spec for the EA Starting Blocks admin application.')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
    writeFileSync('./sbaa-swagger.json', JSON.stringify(document, null, 2));
    Logger.verbose(`OpenAPI spec available at ${config.MY_URL}/api or file:./sbaa-swagger.json`);
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
}

bootstrap();
