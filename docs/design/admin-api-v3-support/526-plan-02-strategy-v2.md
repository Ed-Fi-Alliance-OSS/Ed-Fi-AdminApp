# Phase 2: `V2AdminApiVersionStrategy`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase: [526-plan-01-strategy-core.md](./526-plan-01-strategy-core.md).
> Next phase: [526-plan-03-strategy-v3-and-factory.md](./526-plan-03-strategy-v3-and-factory.md).

## Task 2: `V2AdminApiVersionStrategy`

This is the largest single unit in the plan: it absorbs `syncv2Environment` (from
`SbEnvironmentsEdFiService`), and `bootstrapEnvironmentCredentials` +
`provisionCredentialsForNewTenants` + their private `createClientCredentials` (from
`AdminApiSyncService`).

**Files:**
- Create: `packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.ts`
- Test: `packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.spec.ts`

**Interfaces:**
- Consumes: `AdminApiVersionStrategy`, `BuildConfigPublicInput`, `DispatchSyncResult`
  (Phase 1). `IJobQueueService` (`packages/api/src/sb-sync/job-queue/job-queue.interface.ts`).
  `ENV_SYNC_CHNL` (`packages/api/src/sb-sync/sb-sync.module.ts`).
- Produces: `V2AdminApiVersionStrategy` class — extended by `V3AdminApiVersionStrategy`
  in Phase 3.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.spec.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nx test api --testPathPattern=v2-admin-api-version.strategy.spec.ts`
Expected: FAIL — `Cannot find module './v2-admin-api-version.strategy'`

- [ ] **Step 3: Implement `V2AdminApiVersionStrategy`**

```typescript
// packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import {
  ISbEnvironmentConfigPrivateV2,
  ISbEnvironmentConfigPublicV2,
  PostSbEnvironmentDto,
  SbV2MetaEnv,
  TenantDto,
} from '@edanalytics/models';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import { ENV_SYNC_CHNL } from '../sb-sync/sb-sync.module';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import { AdminApiVersionStrategy, BuildConfigPublicInput, DispatchSyncResult } from './admin-api-version-strategy.interface';

@Injectable()
export class V2AdminApiVersionStrategy implements AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3' = 'v2';
  readonly supportsMultiTenant = true;
  protected readonly logger = new Logger(V2AdminApiVersionStrategy.name);

  constructor(
    protected readonly adminApiServiceV2: AdminApiServiceV2,
    @Inject('IJobQueueService')
    protected readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    protected readonly queueRepository: Repository<SbSyncQueue>,
    @InjectRepository(SbEnvironment)
    protected readonly sbEnvironmentsRepository: Repository<SbEnvironment>
  ) {}

  getAdminApiService() {
    return this.adminApiServiceV2;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse, tenantMode }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: this.version as 'v2',
      values: {
        meta: {
          envlabel: createSbEnvironmentDto.environmentLabel,
          mode: tenantMode,
          domainName: createSbEnvironmentDto.odsApiDiscoveryUrl,
          adminApiUrl: createSbEnvironmentDto.adminApiUrl,
          tenantManagementFunctionArn: '',
          tenantResourceTreeFunctionArn: '',
          odsManagementFunctionArn: '',
          edorgManagementFunctionArn: '',
          dataFreshnessFunctionArn: '',
        } satisfies SbV2MetaEnv,
        adminApiUuid: randomUUID(),
      },
    } as any;
  }

  applyOdsUrlUpdate(existingConfigPublic: any, newOdsApiDiscoveryUrl: string) {
    const existingValues = existingConfigPublic?.values ?? {};
    return {
      ...existingValues,
      meta: {
        ...existingValues.meta,
        domainName: newOdsApiDiscoveryUrl.replace(/^https?:\/\//, ''),
      },
    };
  }

  getTenantModeDefault(existingEnvironment: SbEnvironment): boolean {
    const values = existingEnvironment.configPublic?.values;
    return (
      !!values &&
      'meta' in values &&
      (values as ISbEnvironmentConfigPublicV2).meta?.mode === 'MultiTenant'
    );
  }

  shouldTriggerResync(hasUrlUpdates: boolean): boolean {
    return hasUrlUpdates;
  }

  getRegistrationHeaders(isMultitenant: boolean, tenant?: string): Record<string, string> {
    return isMultitenant
      ? { 'Content-Type': 'application/x-www-form-urlencoded', tenant: tenant! }
      : { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  async dispatchSync(sbEnvironment: SbEnvironment): Promise<DispatchSyncResult> {
    const id = await this.jobQueue.send(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: sbEnvironment.id },
      { expireInHours: 2 }
    );

    const pendingStates = new Set(['created', 'retry', 'active']);
    const maxAttempts = 20;
    const pollIntervalMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
      const queueItem = await this.queueRepository.findOneBy({ id });
      if (queueItem && !pendingStates.has(queueItem.state)) {
        return { kind: 'queued', syncQueue: queueItem };
      }
    }

    const queueItem = await this.queueRepository.findOneBy({ id });
    if (queueItem) return { kind: 'queued', syncQueue: queueItem };

    const fallback = new SbSyncQueue();
    fallback.id = id;
    fallback.state = 'active';
    return { kind: 'queued', syncQueue: fallback };
  }

  async bootstrapCredentials(sbEnvironment: SbEnvironment): Promise<void> {
    const configPublic = sbEnvironment.configPublic;
    if (!configPublic?.values) return;

    const config = configPublic.values as ISbEnvironmentConfigPublicV2;
    if (Object.keys(config?.tenants || {}).length > 0) {
      this.logger.log(`Environment ${sbEnvironment.name} already has credentials, skipping bootstrap`);
      return;
    }

    const isMultiTenant = config?.meta?.mode === 'MultiTenant';
    let tenantNames: string[];

    if (isMultiTenant) {
      try {
        const rootClient = axios.create({ baseURL: sbEnvironment.adminApiUrl!.replace(/\/$/, '') });
        const rootResponse = await rootClient
          .get<{ tenancy?: { multitenantMode?: boolean; tenants?: string[] } }>('/')
          .then((r) => r.data);

        if (
          rootResponse?.tenancy?.multitenantMode === true &&
          Array.isArray(rootResponse.tenancy.tenants) &&
          rootResponse.tenancy.tenants.length > 0
        ) {
          tenantNames = rootResponse.tenancy.tenants;
          this.logger.log(`Bootstrap: discovered tenants from root: [${tenantNames.join(', ')}]`);
        } else {
          tenantNames = ['default'];
          this.logger.log('Bootstrap: root endpoint did not return tenant list, falling back to default');
        }
      } catch (error) {
        this.logger.error(`Bootstrap: failed to reach Admin API root: ${error.message}`);
        return;
      }
    } else {
      tenantNames = ['default'];
    }

    if (!sbEnvironment.configPrivate) {
      sbEnvironment.configPrivate = { tenants: {} } as ISbEnvironmentConfigPrivateV2;
    }
    if (!config.tenants) config.tenants = {};

    for (const tenantName of tenantNames) {
      try {
        const { clientId, clientSecret } = await this.registerCredentials(
          sbEnvironment.adminApiUrl!,
          tenantName,
          isMultiTenant
        );
        config.tenants![tenantName] = { adminApiKey: clientId };

        const privateConfig = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2;
        if (!privateConfig.tenants) privateConfig.tenants = {};
        privateConfig.tenants[tenantName] = { adminApiSecret: clientSecret };

        this.logger.log(`Bootstrap: registered credentials for tenant '${tenantName}'`);
      } catch (error) {
        this.logger.error(`Bootstrap: failed to register credentials for tenant '${tenantName}': ${error.message}`);
      }
    }

    await this.sbEnvironmentsRepository.save(sbEnvironment);
    this.logger.log(`Bootstrap complete for environment: ${sbEnvironment.name}`);
  }

  async provisionCredentialsForNewTenants(
    sbEnvironment: SbEnvironment,
    discoveredTenants: TenantDto[]
  ): Promise<void> {
    const configPublic = sbEnvironment.configPublic;
    if (!configPublic?.values) return;

    const config = configPublic.values as ISbEnvironmentConfigPublicV2;
    const configPrivate = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2 | null;

    const existingTenants = Object.keys(config.tenants || {});
    const discoveredTenantNames = discoveredTenants.map((t) => t.name);
    const newTenants = discoveredTenantNames.filter((name) => !existingTenants.includes(name));

    if (newTenants.length === 0) {
      this.logger.log('No new tenants to provision credentials for');
      return;
    }

    this.logger.log(`Provisioning credentials for ${newTenants.length} new tenant(s): ${newTenants.join(', ')}`);

    if (!config.tenants) config.tenants = {};
    if (!configPrivate?.tenants) {
      if (!sbEnvironment.configPrivate) {
        sbEnvironment.configPrivate = { tenants: {} } as ISbEnvironmentConfigPrivateV2;
      } else {
        (sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2).tenants = {};
      }
    }

    for (const tenantName of newTenants) {
      try {
        const { clientId, clientSecret } = await this.registerCredentials(
          sbEnvironment.adminApiUrl!,
          tenantName,
          true
        );
        config.tenants![tenantName] = { adminApiKey: clientId };

        const privateConfig = sbEnvironment.configPrivate as ISbEnvironmentConfigPrivateV2;
        if (!privateConfig.tenants) privateConfig.tenants = {};
        privateConfig.tenants[tenantName] = { adminApiSecret: clientSecret };

        this.logger.log(`Successfully provisioned credentials for tenant: ${tenantName}`);
      } catch (error) {
        this.logger.error(`Failed to provision credentials for tenant ${tenantName}: ${error.message}`, error.stack);
      }
    }

    await this.sbEnvironmentsRepository.save(sbEnvironment);
    this.logger.log(`Updated environment config with credentials for ${newTenants.length} new tenant(s)`);
  }

  /** Registers Admin API client credentials via /connect/register. Throws a plain Error on failure. */
  protected async registerCredentials(
    adminApiUrl: string,
    tenantName: string,
    isMultiTenant: boolean
  ): Promise<{ clientId: string; clientSecret: string; displayName: string }> {
    const registerUrl = `${adminApiUrl}/connect/register`;
    const secretCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const secretBytes = randomBytes(32);
    const clientSecret = Array.from(secretBytes, (byte) => secretCharset[byte % secretCharset.length]).join('');
    const clientId = `client_${randomUUID()}`;
    const nameSuffixBytes = randomBytes(4);
    const displayNameSuffix = Array.from(nameSuffixBytes, (byte) => (byte % 36).toString(36)).join('');
    const displayName = `AdminApp-v4-${displayNameSuffix}`;

    const formData = new URLSearchParams();
    formData.append('ClientId', clientId);
    formData.append('ClientSecret', clientSecret);
    formData.append('DisplayName', displayName);

    try {
      const registerResponse = await axios.post(registerUrl, formData.toString(), {
        headers: this.getRegistrationHeaders(isMultiTenant, tenantName),
      });
      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }
      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error(`Failed to register client credentials for tenant ${tenantName}:`, error);
      if (error.response?.status === 400 && isMultiTenant) {
        throw new Error(`Tenant '${tenantName}' does not exist or is not properly configured in the Admin API`);
      }
      throw new Error(`Failed to create credentials: ${error.message}`);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nx test api --testPathPattern=v2-admin-api-version.strategy.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.ts packages/api/src/admin-api-version-strategy/v2-admin-api-version.strategy.spec.ts
git commit -m "feat(AC-526): add V2AdminApiVersionStrategy"
```

Next: [526-plan-03-strategy-v3-and-factory.md](./526-plan-03-strategy-v3-and-factory.md).
