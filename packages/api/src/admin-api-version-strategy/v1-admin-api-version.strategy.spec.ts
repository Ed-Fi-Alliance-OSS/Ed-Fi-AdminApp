import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { AdminApiServiceV1, StartingBlocksServiceV1 } from '../teams/edfi-tenants/starting-blocks';
import { ValidationHttpException } from '../utils';
import * as syncOds from '../sb-sync/sync-ods';

jest.mock('../sb-sync/sync-ods');

describe('V1AdminApiVersionStrategy', () => {
  let strategy: V1AdminApiVersionStrategy;
  let edfiTenantsRepository: { find: jest.Mock; save: jest.Mock };
  let entityManager: { transaction: jest.Mock };
  let startingBlocksServiceV1: { saveAdminApiCredentials: jest.Mock };
  let adminApiServiceV1: AdminApiServiceV1;

  beforeEach(async () => {
    edfiTenantsRepository = { find: jest.fn(), save: jest.fn() };
    entityManager = { transaction: jest.fn((cb) => Promise.resolve(cb({}))) };
    startingBlocksServiceV1 = { saveAdminApiCredentials: jest.fn() };
    adminApiServiceV1 = {} as AdminApiServiceV1;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V1AdminApiVersionStrategy,
        { provide: AdminApiServiceV1, useValue: adminApiServiceV1 },
        { provide: StartingBlocksServiceV1, useValue: startingBlocksServiceV1 },
        { provide: getRepositoryToken(EdfiTenant), useValue: edfiTenantsRepository },
        { provide: getEntityManagerToken(), useValue: entityManager },
      ],
    }).compile();

    strategy = module.get(V1AdminApiVersionStrategy);
  });

  it('reports version "v1" and no multi-tenant support', () => {
    expect(strategy.version).toBe('v1');
    expect(strategy.supportsMultiTenant).toBe(false);
  });

  it('getAdminApiService returns the injected AdminApiServiceV1', () => {
    expect(strategy.getAdminApiService()).toBe(adminApiServiceV1);
  });

  it('buildConfigPublic returns the v1-shaped configPublic', () => {
    const result = strategy.buildConfigPublic({
      createSbEnvironmentDto: {
        startingBlocks: false,
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
      } as any,
      odsApiMetaResponse: { version: '5.3' },
      tenantMode: 'SingleTenant',
    });

    expect(result).toEqual({
      startingBlocks: false,
      odsApiMeta: { version: '5.3' },
      adminApiUrl: 'https://api.test.com',
      version: 'v1',
      values: {
        edfiHostname: 'https://ods.test.com',
        adminApiUrl: 'https://api.test.com',
      },
    });
  });

  it('applyOdsUrlUpdate returns an edfiHostname patch', () => {
    const patch = strategy.applyOdsUrlUpdate(
      { version: 'v1', values: { edfiHostname: 'old.test.com', adminApiUrl: 'https://api.test.com' } } as any,
      'https://new.test.com'
    );
    expect(patch).toEqual({ edfiHostname: 'https://new.test.com' });
  });

  it('getTenantModeDefault is always false', () => {
    expect(strategy.getTenantModeDefault({} as SbEnvironment)).toBe(false);
  });

  it('shouldTriggerResync is always false (v1 resync is handled by its own credential-recreation branch)', () => {
    expect(strategy.shouldTriggerResync(true)).toBe(false);
  });

  it('getRegistrationHeaders never includes a tenant header', () => {
    expect(strategy.getRegistrationHeaders(true, 'some-tenant')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  it('bootstrapCredentials and provisionCredentialsForNewTenants are no-ops', async () => {
    await expect(strategy.bootstrapCredentials({} as SbEnvironment)).resolves.toBeUndefined();
    await expect(
      strategy.provisionCredentialsForNewTenants({} as SbEnvironment, [])
    ).resolves.toBeUndefined();
  });

  describe('dispatchSync', () => {
    it('throws if createSbEnvironmentDto is omitted', async () => {
      await expect(strategy.dispatchSync({} as SbEnvironment)).rejects.toThrow(
        'V1AdminApiVersionStrategy.dispatchSync requires createSbEnvironmentDto'
      );
    });

    it('throws ValidationHttpException when no tenants are provided', async () => {
      await expect(
        strategy.dispatchSync({ id: 1 } as SbEnvironment, { tenants: [] } as any)
      ).rejects.toThrow(ValidationHttpException);
    });

    it('creates the default tenant, syncs its ODS data, registers credentials, and returns inline', async () => {
      edfiTenantsRepository.find.mockResolvedValue([]);
      edfiTenantsRepository.save.mockResolvedValue({ id: 10, name: 'tenant-a', sbEnvironmentId: 1 });
      jest.spyOn(strategy as any, 'createClientCredentials').mockResolvedValue({
        clientId: 'client_1',
        clientSecret: 'secret',
        displayName: 'AdminApp-v4-abcd',
      });

      const result = await strategy.dispatchSync(
        { id: 1 } as SbEnvironment,
        {
          adminApiUrl: 'https://api.test.com',
          tenants: [{ name: 'tenant-a', odss: [] }],
        } as any
      );

      expect(result).toEqual({ kind: 'inline' });
      expect(startingBlocksServiceV1.saveAdminApiCredentials).toHaveBeenCalledWith(
        { id: 1 },
        {
          ClientId: 'client_1',
          ClientSecret: 'secret',
          url: 'https://api.test.com',
        }
      );
    });
  });
});
