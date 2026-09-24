import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AppController } from './app.controller';
import { HealthService } from './health.service';

describe('Healthcheck HTTP database readiness', () => {
  let app: INestApplication;
  const runner = {
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    runner.connect.mockReset().mockResolvedValue(undefined);
    runner.query.mockReset().mockResolvedValue([{ value: 1 }]);
    runner.release.mockReset().mockResolvedValue(undefined);
    dataSource.createQueryRunner.mockReset().mockReturnValue(runner);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [HealthService, { provide: getDataSourceToken(), useValue: dataSource }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it.each(['connect', 'query'] as const)(
    'returns 503 for a database %s failure and 200 after recovery',
    async (method) => {
      runner[method].mockRejectedValueOnce(new Error('database unavailable'));

      const failed = await request(app.getHttpServer()).get('/api/healthcheck').expect(503);
      expect(failed.body).toEqual({
        status: 'unhealthy',
        timestamp: expect.any(String),
        checks: {
          api: { status: 'healthy', message: 'API is responding' },
          database: { status: 'unhealthy', message: 'Database connection failed' },
        },
      });

      const recovered = await request(app.getHttpServer()).get('/api/healthcheck').expect(200);
      expect(recovered.body.status).toBe('healthy');
      expect(recovered.body.checks.database).toEqual({
        status: 'healthy',
        message: 'Database connection successful',
      });
      expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(2);
      expect(runner.release).toHaveBeenCalledTimes(2);
      expect(dataSource.destroy).not.toHaveBeenCalled();
    },
  );

  it('returns 503 on the response deadline and recovers after pending work settles', async () => {
    let finishQuery!: (rows: unknown[]) => void;
    const query = new Promise<unknown[]>((resolve) => {
      finishQuery = resolve;
    });
    runner.query.mockReturnValueOnce(query);
    try {
      const response = await request(app.getHttpServer()).get('/api/healthcheck').expect(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.database.status).toBe('unhealthy');
      expect(runner.release).not.toHaveBeenCalled();
    } finally {
      finishQuery([{ value: 1 }]);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    const recovered = await request(app.getHttpServer()).get('/api/healthcheck').expect(200);
    expect(recovered.body.status).toBe('healthy');
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(2);
    expect(runner.release).toHaveBeenCalledTimes(2);
    expect(dataSource.destroy).not.toHaveBeenCalled();
  }, 10000);
});
