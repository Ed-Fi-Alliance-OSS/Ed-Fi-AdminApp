import './modes/dev';
process.env['NODE_CONFIG_DIR'] = './packages/api/config';
import './utils/checkEnv';
import { formErrFromValidator, wait } from '@edanalytics/utils';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import colors from 'colors/safe';
import * as config from 'config';
import * as pgSession from 'connect-pg-simple';
import * as expressSession from 'express-session';
import passport from 'passport';
import { Client } from 'pg';
import { AppModule } from './app/app.module';
import { CustomHttpException } from './utils/customExceptions';
import { writeFileSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  await config.DB_ENCRYPTION_SECRET;
  const pgConnectionStr = await config.DB_CONNECTION_STRING;
  const pgClient = new Client({ connectionString: pgConnectionStr });
  await pgClient.connect();
  const existingSchema = await pgClient.query(
    "select schema_name from information_schema.schemata where schema_name = 'appsession'"
  );
  if (existingSchema.rowCount === 0) await pgClient.query('create schema appsession');

  app.use(
    expressSession.default({
      store: new (pgSession.default(expressSession.default))({
        createTableIfMissing: true,
        conString: pgConnectionStr,
        schemaName: 'appsession',
      }),
      secret: 'my-secret',
      resave: false,
      saveUninitialized: false,
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

  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
