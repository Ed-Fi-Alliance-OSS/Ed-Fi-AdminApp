import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

type HealthServiceWithPrivateMembers = {
  checkDatabaseIndependently: () => Promise<boolean>;
};

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();
    service = module.get(HealthService);
  });

  it('getHealth() returns healthy status when DB check passes', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(true);
    const result = await service.getHealth();
    expect(result.status).toBe('healthy');
    expect(result.checks.api.status).toBe('healthy');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.timestamp).toBeTruthy();
  });

  it('getHealth() returns unhealthy when DB check returns false', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(false);
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.checks.api.status).toBe('healthy');
  });

  it('getHealth() returns unhealthy when DB check throws a regular error', async () => {
    jest
      .spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently')
      .mockRejectedValueOnce(new Error('connection refused'));
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.checks.database.message).toContain('Database unavailable');
  });

  it('getHealth() handles AggregateError from DB check', async () => {
    const aggErr = Object.assign(new Error('aggregate'), {
      name: 'AggregateError',
      errors: [new Error('inner db error')],
    });
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockRejectedValueOnce(aggErr);
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
  });

  it('getHealth() includes a valid ISO timestamp', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(true);
    const result = await service.getHealth();
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

type HealthServiceInternals = {
  performDirectDatabaseCheck: () => Promise<boolean>;
  performMssqlCheck: () => Promise<boolean>;
  performPostgresCheck: () => Promise<boolean>;
};

// jest.config.ts maps 'config' to src/test/config.mock.ts, which uses `export = config`.
// `import * as config` would give an __importStar namespace whose properties are getter-only
// and therefore unassignable; requireActual returns the underlying mutable object instead.
const mutableConfig = jest.requireActual('config') as unknown as Record<string, unknown>;

describe('HealthService.performDirectDatabaseCheck', () => {
  let internals: HealthServiceInternals;
  let mssqlCheck: jest.SpyInstance;
  let postgresCheck: jest.SpyInstance;
  const originalEngine = mutableConfig.DB_ENGINE;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();
    internals = module.get(HealthService) as unknown as HealthServiceInternals;

    // Stubbing both branches keeps these tests off the network: what is under test is the
    // engine routing and the guarantee that a boolean always comes back, not the drivers.
    mssqlCheck = jest.spyOn(internals, 'performMssqlCheck').mockResolvedValue(true);
    postgresCheck = jest.spyOn(internals, 'performPostgresCheck').mockResolvedValue(true);
  });

  afterEach(() => {
    mutableConfig.DB_ENGINE = originalEngine;
    jest.restoreAllMocks();
  });

  it('routes to the MSSQL check when the engine is mssql', async () => {
    mutableConfig.DB_ENGINE = 'mssql';

    await expect(internals.performDirectDatabaseCheck()).resolves.toBe(true);
    expect(mssqlCheck).toHaveBeenCalled();
    expect(postgresCheck).not.toHaveBeenCalled();
  });

  it('routes to the Postgres check when the engine is pgsql', async () => {
    mutableConfig.DB_ENGINE = 'pgsql';

    await expect(internals.performDirectDatabaseCheck()).resolves.toBe(true);
    expect(postgresCheck).toHaveBeenCalled();
    expect(mssqlCheck).not.toHaveBeenCalled();
  });

  // The fallthrough is load-bearing: anything that is not mssql must behave as Postgres.
  it('falls back to the Postgres check for an unrecognised engine', async () => {
    mutableConfig.DB_ENGINE = undefined;

    await expect(internals.performDirectDatabaseCheck()).resolves.toBe(true);
    expect(postgresCheck).toHaveBeenCalled();
    expect(mssqlCheck).not.toHaveBeenCalled();
  });

  // The whole point of this method is to yield a boolean for the healthcheck endpoint.
  // If it throws, the endpoint reports an error instead of an unhealthy database.
  it.each([
    ['mssql', 'performMssqlCheck'],
    ['pgsql', 'performPostgresCheck'],
  ])('returns false instead of throwing when the %s check rejects', async (engine, method) => {
    mutableConfig.DB_ENGINE = engine;
    jest
      .spyOn(internals, method as 'performMssqlCheck' | 'performPostgresCheck')
      .mockRejectedValue(new Error('connection refused'));

    await expect(internals.performDirectDatabaseCheck()).resolves.toBe(false);
  });
});

