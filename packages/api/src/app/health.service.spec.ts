import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Client } from 'pg';
import { HealthService } from './health.service';

jest.mock('pg', () => ({
  Client: jest.fn(() => {
    throw new Error('Direct pg healthcheck is forbidden');
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('HealthService', () => {
  let module: TestingModule;
  let service: HealthService;
  const runner = {
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: jest.fn(),
    initialize: jest.fn(),
    destroy: jest.fn(),
  };
  let warn: jest.SpyInstance;
  let debug: jest.SpyInstance;

  const bodyFor = (status: 'healthy' | 'unhealthy') => ({
    status,
    timestamp: expect.any(String),
    checks: {
      api: { status: 'healthy', message: 'API is responding' },
      database: {
        status,
        message:
          status === 'healthy' ? 'Database connection successful' : 'Database connection failed',
      },
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    runner.connect.mockReset().mockResolvedValue(undefined);
    runner.query.mockReset().mockResolvedValue([{ value: 1 }]);
    runner.release.mockReset().mockResolvedValue(undefined);
    dataSource.createQueryRunner.mockReset().mockReturnValue(runner);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    module = await Test.createTestingModule({
      providers: [HealthService, { provide: getDataSourceToken(), useValue: dataSource }],
    }).compile();
    service = module.get(HealthService);
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    await module.close();
  });

  it('uses TypeORM, releases once, and preserves the healthy body', async () => {
    const result = await service.getHealth();
    expect(result).toEqual(bodyFor('healthy'));
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    expect(runner.connect).toHaveBeenCalledTimes(1);
    expect(runner.query).toHaveBeenCalledWith('SELECT 1');
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(Client).not.toHaveBeenCalled();
    expect(dataSource.initialize).not.toHaveBeenCalled();
    expect(dataSource.destroy).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('logs runner creation failure without releasing a missing runner', async () => {
    dataSource.createQueryRunner.mockImplementationOnce(() => {
      throw new Error('creation failed');
    });
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('connection failed'));
    expect(runner.release).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    ['connect', 0],
    ['query', 1],
  ] as const)('logs a %s failure at warn and releases once', async (method, queryCalls) => {
    runner[method].mockRejectedValueOnce(
      Object.assign(new Error('private database detail'), { code: 'ECONNREFUSED' }),
    );
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    expect(debug).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(runner.query).toHaveBeenCalledTimes(queryCalls);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([null, undefined, 'failure', 42, Symbol('failure')])(
    'handles a non-Error rejection: %p',
    async (error) => {
      runner.query.mockRejectedValueOnce(error);
      expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(runner.release).toHaveBeenCalledTimes(1);
    },
  );

  it('handles cyclic objects without invoking custom stringification', async () => {
    const error: Record<string, unknown> = {};
    error.self = error;
    error.toString = () => {
      throw new Error('must not be invoked');
    };
    runner.query.mockRejectedValueOnce(error);
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"kind":"object"'));
  });

  it.each([
    new AggregateError(
      [Object.assign(new Error('private child'), { code: 'ELOGIN' }), null],
      'private aggregate',
    ),
    Object.assign(new Error('private aggregate'), {
      name: 'AggregateError',
      errors: [new Error('private child'), null],
    }),
  ])('logs aggregate error counts once at warn without inner messages: %p', async (error) => {
    runner.query.mockRejectedValueOnce(error);
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith(
      'Database health check query failed: {"kind":"AggregateError","errorCount":2}',
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private');
  });

  it.each([
    ['ECONNREFUSED', 'Connection refused'],
    ['ECONNRESET', 'Connection reset by peer'],
    ['ETIMEDOUT', 'Network operation timed out'],
    ['EPIPE', 'Attempted write to a closed connection'],
    ['ELOGIN', 'Database login failed'],
    ['ETIMEOUT', 'Database operation timed out'],
    ['ESOCKET', 'Database socket error'],
    ['ENOTOPEN', 'Database connection is not open'],
    ['28P01', 'Password authentication failed'],
    ['3D000', 'Invalid database/catalog name'],
    ['53300', 'Too many database connections'],
    ['57P01', 'Connection terminated by administrative shutdown'],
    ['57P03', 'Database cannot accept connections now'],
    ['08000', 'Database connection exception'],
    ['08003', 'Database connection does not exist'],
    ['08006', 'Database connection failure'],
  ])(
    'logs the safe description for %s without exposing it in the response',
    async (code, description) => {
      runner.query.mockRejectedValueOnce(
        Object.assign(new Error('private database detail'), { code }),
      );
      expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
      expect(warn).toHaveBeenCalledWith(
        `Database health check query failed: {"kind":"Error","code":"${code}","description":"${description}"}`,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(debug).not.toHaveBeenCalled();
    },
  );

  it.each(['UNRECOGNIZED_DRIVER_CODE', 'toString', '__proto__', 'constructor', 42])(
    'omits unrecognized codes and their descriptions: %p',
    async (code) => {
      runner.query.mockRejectedValueOnce(Object.assign(new Error('private detail'), { code }));
      expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
      expect(warn).toHaveBeenCalledWith('Database health check query failed: {"kind":"Error"}');
    },
  );

  it('does not invoke a driver code getter while logging', async () => {
    const getCode = jest.fn(() => {
      throw new Error('private getter failure');
    });
    runner.query.mockRejectedValueOnce(
      Object.defineProperty(new Error('private detail'), 'code', { get: getCode }),
    );
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(getCode).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Database health check query failed: {"kind":"Error"}');
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('does not emit credential-like or multiline exception content', async () => {
    const sensitiveDetail = 'Password=health-test-sentinel\r\nFORGED LOG';
    runner.query.mockRejectedValueOnce(
      Object.assign(new Error(sensitiveDetail), { code: sensitiveDetail }),
    );
    const result = await service.getHealth();
    expect(result).toEqual(bodyFor('unhealthy'));
    expect(JSON.stringify([result, warn.mock.calls])).not.toContain('health-test-sentinel');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('FORGED LOG');
  });

  it('logs cleanup rejection without replacing a successful query result', async () => {
    runner.release.mockRejectedValueOnce(
      Object.assign(new Error('cleanup'), { code: 'ECONNRESET' }),
    );
    expect(await service.getHealth()).toEqual(bodyFor('healthy'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cleanup failed'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('logs both query and cleanup failures without masking either', async () => {
    runner.query.mockRejectedValueOnce(new Error('query'));
    runner.release.mockRejectedValueOnce(null);
    expect(await service.getHealth()).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('query failed'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cleanup failed'));
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('returns at 3000 ms, not earlier, without releasing an active query', async () => {
    const query = deferred<unknown[]>();
    runner.query.mockReturnValueOnce(query.promise);
    let settled = false;
    const response = service.getHealth().then((result) => {
      settled = true;
      return result;
    });
    await jest.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await response).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledWith('Database health check response timeout after 3000 ms');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(runner.release).not.toHaveBeenCalled();
    query.resolve([{ value: 1 }]);
    await jest.advanceTimersByTimeAsync(0);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(dataSource.destroy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('observes and logs a late query rejection after timeout', async () => {
    const query = deferred<unknown[]>();
    runner.query.mockReturnValueOnce(query.promise);
    const response = service.getHealth();
    await jest.advanceTimersByTimeAsync(3000);
    expect(await response).toEqual(bodyFor('unhealthy'));
    query.reject(new Error('late rejection'));
    await jest.advanceTimersByTimeAsync(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('query failed'));
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('releases after late connection acquisition, not before it', async () => {
    const connection = deferred<void>();
    runner.connect.mockReturnValueOnce(connection.promise);
    const response = service.getHealth();
    await jest.advanceTimersByTimeAsync(3000);
    expect(await response).toEqual(bodyFor('unhealthy'));
    expect(runner.release).not.toHaveBeenCalled();
    connection.resolve(undefined);
    await jest.advanceTimersByTimeAsync(0);
    expect(runner.query).toHaveBeenCalledWith('SELECT 1');
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('bounds hanging cleanup without releasing twice', async () => {
    const cleanup = deferred<void>();
    runner.release.mockReturnValueOnce(cleanup.promise);
    const response = service.getHealth();
    await jest.advanceTimersByTimeAsync(3000);
    expect(await response).toEqual(bodyFor('unhealthy'));
    expect(runner.release).toHaveBeenCalledTimes(1);
    cleanup.resolve(undefined);
    await jest.advanceTimersByTimeAsync(0);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('shares pending work across timed-out polls and retries after settlement', async () => {
    const query = deferred<unknown[]>();
    runner.query.mockReturnValueOnce(query.promise);
    const first = service.getHealth();
    const concurrent = service.getHealth();
    await jest.advanceTimersByTimeAsync(3000);
    expect(await first).toEqual(bodyFor('unhealthy'));
    expect(await concurrent).toEqual(bodyFor('unhealthy'));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(1, 'Database health check response timeout after 3000 ms');
    expect(warn).toHaveBeenNthCalledWith(2, 'Database health check response timeout after 3000 ms');
    const later = service.getHealth();
    await jest.advanceTimersByTimeAsync(3000);
    const laterResult = await later;
    expect(laterResult).toEqual(bodyFor('unhealthy'));
    expect(laterResult.timestamp).not.toBe((await first).timestamp);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
    query.resolve([{ value: 1 }]);
    await jest.advanceTimersByTimeAsync(0);
    expect(await service.getHealth()).toEqual(bodyFor('healthy'));
    expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(2);
    expect(runner.release).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });
});
