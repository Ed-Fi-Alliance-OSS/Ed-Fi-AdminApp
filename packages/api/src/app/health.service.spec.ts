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

type HealthServiceWithDirectCheck = {
  performDirectDatabaseCheck: () => Promise<boolean>;
};

// jest.config.ts maps 'config' to src/test/config.mock.ts, which uses `export = config`.
// `import * as config` would give an __importStar namespace whose properties are getter-only
// and therefore unassignable; requireActual returns the underlying mutable object instead.
const mutableConfig = jest.requireActual('config') as unknown as Record<string, unknown>;

describe('HealthService.performDirectDatabaseCheck', () => {
  let directService: HealthService;
  const originalEngine = mutableConfig.DB_ENGINE;
  const originalConnectionString = mutableConfig.DB_CONNECTION_STRING;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();
    directService = module.get(HealthService);
  });

  afterEach(() => {
    mutableConfig.DB_ENGINE = originalEngine;
    mutableConfig.DB_CONNECTION_STRING = originalConnectionString;
    jest.restoreAllMocks();
  });

  // Port 1 on loopback: refused immediately, with no DNS lookup. A hostname here (even an
  // unresolvable one) makes these tests depend on resolver latency, which is fine in isolation
  // but can exceed Jest's 5s default timeout when the whole suite runs in parallel.
  const REFUSED = '127.0.0.1:1';

  // The whole point of this method is to yield a boolean for the healthcheck endpoint.
  // If it throws, the endpoint reports an error instead of an unhealthy database.
  it('returns false instead of throwing when the MSSQL connection fails', async () => {
    mutableConfig.DB_ENGINE = 'mssql';
    mutableConfig.DB_CONNECTION_STRING = `mssql://sa:pw@${REFUSED}/sbaa`;

    const result = await (
      directService as unknown as HealthServiceWithDirectCheck
    ).performDirectDatabaseCheck();

    expect(result).toBe(false);
  });

  it('returns false instead of throwing when the Postgres connection fails', async () => {
    mutableConfig.DB_ENGINE = 'pgsql';
    mutableConfig.DB_CONNECTION_STRING = `postgres://u:p@${REFUSED}/db`;

    const result = await (
      directService as unknown as HealthServiceWithDirectCheck
    ).performDirectDatabaseCheck();

    expect(result).toBe(false);
  });
});

