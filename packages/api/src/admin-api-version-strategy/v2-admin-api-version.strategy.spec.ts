import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { TenantDto } from '@edanalytics/models';

describe('V2AdminApiVersionStrategy', () => {
  let strategy: V2AdminApiVersionStrategy;
  let jobQueue: { send: jest.Mock };
  let queueRepository: { findOneBy: jest.Mock };
  let sbEnvironmentsRepository: { findOne: jest.Mock; save: jest.Mock };
  let adminApiServiceV2: AdminApiServiceV2;

  beforeEach(async () => {
    jobQueue = { send: jest.fn().mockResolvedValue('job-1') };
    queueRepository = { findOneBy: jest.fn() };
    sbEnvironmentsRepository = { findOne: jest.fn(), save: jest.fn() };
    adminApiServiceV2 = {} as AdminApiServiceV2;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V2AdminApiVersionStrategy,
        { provide: AdminApiServiceV2, useValue: adminApiServiceV2 },
        { provide: 'IJobQueueService', useValue: jobQueue },
        { provide: getRepositoryToken(SbSyncQueue), useValue: queueRepository },
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
      ],
    }).compile();

    strategy = module.get(V2AdminApiVersionStrategy);
  });

  it('reports version "v2" and multi-tenant support', () => {
    expect(strategy.version).toBe('v2');
    expect(strategy.supportsMultiTenant).toBe(true);
  });

  it('getAdminApiService returns the injected AdminApiServiceV2', () => {
    expect(strategy.getAdminApiService()).toBe(adminApiServiceV2);
  });

  it('buildConfigPublic returns the v2-shaped configPublic with SbV2MetaEnv meta', () => {
    const result: any = strategy.buildConfigPublic({
      createSbEnvironmentDto: {
        startingBlocks: false,
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        environmentLabel: 'my-env',
      } as any,
      odsApiMetaResponse: { version: '5.3' },
      tenantMode: 'MultiTenant',
    });

    expect(result.version).toBe('v2');
    expect(result.values.meta).toEqual({
      envlabel: 'my-env',
      mode: 'MultiTenant',
      domainName: 'https://ods.test.com',
      adminApiUrl: 'https://api.test.com',
      tenantManagementFunctionArn: '',
      tenantResourceTreeFunctionArn: '',
      odsManagementFunctionArn: '',
      edorgManagementFunctionArn: '',
      dataFreshnessFunctionArn: '',
    });
    expect(typeof result.values.adminApiUuid).toBe('string');
  });

  it('applyOdsUrlUpdate patches meta.domainName', () => {
    const patch = strategy.applyOdsUrlUpdate(
      { version: 'v2', values: { meta: { domainName: 'old.test.com', mode: 'SingleTenant' } } } as any,
      'https://new.test.com/'
    );
    expect(patch).toEqual({
      meta: { domainName: 'new.test.com', mode: 'SingleTenant' },
    });
  });

  it('getTenantModeDefault reads meta.mode === MultiTenant off the existing environment', () => {
    const env = {
      configPublic: { version: 'v2', values: { meta: { mode: 'MultiTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(env)).toBe(true);

    const singleTenantEnv = {
      configPublic: { version: 'v2', values: { meta: { mode: 'SingleTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(singleTenantEnv)).toBe(false);
  });

  it('shouldTriggerResync mirrors hasUrlUpdates', () => {
    expect(strategy.shouldTriggerResync(true)).toBe(true);
    expect(strategy.shouldTriggerResync(false)).toBe(false);
  });

  it('getRegistrationHeaders adds a tenant header only when multitenant', () => {
    expect(strategy.getRegistrationHeaders(true, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      tenant: 'tenant-a',
    });
    expect(strategy.getRegistrationHeaders(false, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  describe('dispatchSync', () => {
    it('enqueues a job and returns the polled queue item once it leaves a pending state', async () => {
      queueRepository.findOneBy.mockResolvedValue({ id: 'job-1', state: 'completed' } as SbSyncQueue);

      const result = await strategy.dispatchSync({ id: 42 } as SbEnvironment);

      expect(jobQueue.send).toHaveBeenCalledWith(
        'sbe-sync',
        { sbEnvironmentId: 42 },
        { expireInHours: 2 }
      );
      expect(result).toEqual({ kind: 'queued', syncQueue: { id: 'job-1', state: 'completed' } });
    });
  });

  describe('bootstrapCredentials', () => {
    it('no-ops when the environment already has tenant credentials', async () => {
      const env = {
        configPublic: { version: 'v2', values: { tenants: { default: { adminApiKey: 'x' } } } },
      } as unknown as SbEnvironment;

      await strategy.bootstrapCredentials(env);

      expect(sbEnvironmentsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('provisionCredentialsForNewTenants', () => {
    it('no-ops when there are no newly discovered tenants', async () => {
      const env = {
        configPublic: { version: 'v2', values: { tenants: { 'tenant-a': { adminApiKey: 'x' } } } },
      } as unknown as SbEnvironment;
      const discovered: TenantDto[] = [{ id: 'tenant-a', name: 'tenant-a', odsInstances: [] }];

      await strategy.provisionCredentialsForNewTenants(env, discovered);

      expect(sbEnvironmentsRepository.save).not.toHaveBeenCalled();
    });
  });
});
