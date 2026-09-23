import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../auth/authorization/public.decorator';
import { AppController } from './app.controller';
import { HealthService, HealthStatus } from './health.service';

describe('AppController healthcheck', () => {
  let app: INestApplication;
  const getHealth = jest.fn<Promise<HealthStatus>, []>();

  beforeEach(async () => {
    getHealth.mockReset();
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: HealthService, useValue: { getHealth } }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it.each(['healthy', 'unhealthy'] as const)(
    'preserves HTTP 200 and the exact %s response',
    async (status) => {
      const body: HealthStatus = {
        status,
        timestamp: '2026-09-22T00:00:00.000Z',
        checks: {
          api: { status: 'healthy', message: 'API is responding' },
          database: {
            status,
            message:
              status === 'healthy'
                ? 'Database connection successful'
                : 'Database connection failed',
          },
        },
      };
      getHealth.mockResolvedValueOnce(body);
      const response = await request(app.getHttpServer()).get('/api/healthcheck');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(body);
      expect(getHealth).toHaveBeenCalledTimes(1);
    },
  );

  it('uses debug rather than info for each request', async () => {
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const info = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    getHealth.mockResolvedValueOnce({
      status: 'healthy',
      timestamp: '2026-09-22T00:00:00.000Z',
      checks: {
        api: { status: 'healthy', message: 'API is responding' },
        database: { status: 'healthy', message: 'Database connection successful' },
      },
    });
    await request(app.getHttpServer()).get('/api/healthcheck').expect(200);
    expect(debug).toHaveBeenCalledWith('Healthcheck endpoint called');
    expect(info).not.toHaveBeenCalledWith('Healthcheck endpoint called');
  });

  it('retains the public route metadata', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AppController.prototype.healthcheck)).toBe(true);
  });

  it.each([
    ['name', 'Health check failed: unexpected failure', '{"kind":"UninspectableError"}'],
    ['errors', 'Health check failed: unexpected failure', '{"kind":"UninspectableError"}'],
    ['message', 'Health check failed: Unknown error', '{"kind":"AggregateError","errorCount":0}'],
  ])('preserves the fallback when the %s getter throws', async (property, message, diagnostic) => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const error = Object.defineProperty(new AggregateError([], 'unexpected failure'), property, {
      get() {
        throw new Error('private accessor failure');
      },
    });
    getHealth.mockRejectedValueOnce(error);
    const response = await request(app.getHttpServer()).get('/api/healthcheck');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'unhealthy',
      timestamp: expect.any(String),
      checks: {
        api: { status: 'healthy', message: 'API is responding' },
        database: { status: 'unhealthy', message },
      },
    });
    expect(logError).toHaveBeenCalledWith(`Healthcheck error: ${diagnostic}`);
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private accessor failure');
  });

  it.each([
    ['getOwnPropertyDescriptor', 'Health check failed: unexpected failure'],
    ['getPrototypeOf', 'Health check failed: Unknown error'],
  ])('preserves the fallback when the %s Proxy trap throws', async (trap, message) => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const error = new Proxy(new Error('unexpected failure'), {
      [trap]() {
        throw new Error('private Proxy failure');
      },
    });
    getHealth.mockRejectedValueOnce(error);
    const response = await request(app.getHttpServer()).get('/api/healthcheck');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.database).toEqual({ status: 'unhealthy', message });
    expect(logError).toHaveBeenCalledWith('Healthcheck error: {"kind":"UninspectableError"}');
  });

  it('preserves the fallback for a revoked Proxy', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    getHealth.mockRejectedValueOnce(proxy);
    const response = await request(app.getHttpServer()).get('/api/healthcheck');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.checks.database).toEqual({
      status: 'unhealthy',
      message: 'Health check failed: Unknown error',
    });
    expect(logError).toHaveBeenCalledWith('Healthcheck error: {"kind":"UninspectableError"}');
  });

  it.each([
    [
      new Error('unexpected failure'),
      'Health check failed: unexpected failure',
      '{"kind":"Error"}',
    ],
    [null, 'Health check failed: Unknown error', '{"kind":"null"}'],
    [
      Object.assign(new Error('unexpected failure'), {
        code: 'ELOGIN',
        detail: 'private-controller-diagnostic',
      }),
      'Health check failed: unexpected failure',
      '{"kind":"Error","code":"ELOGIN","description":"Database login failed"}',
    ],
  ])('preserves the existing controller fallback for %p', async (error, message, diagnostic) => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    getHealth.mockRejectedValueOnce(error);
    const response = await request(app.getHttpServer()).get('/api/healthcheck');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'unhealthy',
      timestamp: expect.any(String),
      checks: {
        api: { status: 'healthy', message: 'API is responding' },
        database: { status: 'unhealthy', message },
      },
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(`Healthcheck error: ${diagnostic}`);
    expect(JSON.stringify(logError.mock.calls)).not.toContain('private-controller-diagnostic');
  });
});
