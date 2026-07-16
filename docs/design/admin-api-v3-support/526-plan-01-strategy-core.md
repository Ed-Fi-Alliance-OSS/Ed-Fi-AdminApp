# Phase 1: `AdminApiVersionStrategy` interface + `V1AdminApiVersionStrategy`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints (they apply here too). Next phase:
> [526-plan-02-strategy-v2.md](./526-plan-02-strategy-v2.md).

## Task 1: `AdminApiVersionStrategy` interface + `V1AdminApiVersionStrategy`

**Files:**
- Create: `packages/api/src/admin-api-version-strategy/admin-api-version-strategy.interface.ts`
- Create: `packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.ts`
- Test: `packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.spec.ts`

**Interfaces:**
- Produces: `AdminApiVersionStrategy` interface, `BuildConfigPublicInput` type,
  `DispatchSyncResult` type, `V1AdminApiVersionStrategy` class — all consumed by every
  later phase.

- [ ] **Step 1: Write the interface file**

```typescript
// packages/api/src/admin-api-version-strategy/admin-api-version-strategy.interface.ts
import { SbEnvironment } from '@edanalytics/models-server';
import { PostSbEnvironmentDto, SbEnvironmentConfigPublic, TenantDto } from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks/v3/admin-api.v3.service';

export type AnyAdminApiService = AdminApiServiceV1 | AdminApiServiceV2 | AdminApiServiceV3;

export interface BuildConfigPublicInput {
  createSbEnvironmentDto: PostSbEnvironmentDto;
  /** Raw ODS API metadata response, stored verbatim on configPublic.odsApiMeta */
  odsApiMetaResponse: unknown;
  tenantMode: 'MultiTenant' | 'SingleTenant';
}

export type DispatchSyncResult =
  | { kind: 'inline' }
  | { kind: 'queued'; syncQueue: SbSyncQueue };

/**
 * One implementation per Admin API specification version ('v1' | 'v2' | 'v3').
 * Replaces the scattered `version === 'v1'/'v2'` checks in
 * SbEnvironmentsEdFiService and AdminApiSyncService.
 */
export interface AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3';
  /** v1 is always single-tenant; v2/v3 support multi-tenant mode. */
  readonly supportsMultiTenant: boolean;

  getAdminApiService(): AnyAdminApiService;

  /** Builds the version-shaped `configPublic` object for a brand-new environment. */
  buildConfigPublic(input: BuildConfigPublicInput): SbEnvironmentConfigPublic;

  /**
   * Builds the `values` patch to merge into `configPublic.values` when the ODS API
   * discovery URL changes on update.
   */
  applyOdsUrlUpdate(
    existingConfigPublic: SbEnvironmentConfigPublic,
    newOdsApiDiscoveryUrl: string
  ): Record<string, unknown>;

  /** Resolves the tenant-mode value the update-time lock check must match. */
  getTenantModeDefault(existingEnvironment: SbEnvironment): boolean;

  /** Whether a URL-affecting update should trigger a background re-sync. */
  shouldTriggerResync(hasUrlUpdates: boolean): boolean;

  /**
   * Runs (or enqueues) the tenant/ODS/EdOrg sync for a newly created or just-updated
   * environment. v1 runs inline and resolves immediately; v2/v3 enqueue a job and poll
   * for its terminal state.
   */
  dispatchSync(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto?: PostSbEnvironmentDto
  ): Promise<DispatchSyncResult>;

  /** Builds the headers for the /connect/register call (adds `tenant` only when applicable). */
  getRegistrationHeaders(isMultitenant: boolean, tenant?: string): Record<string, string>;

  /** First-time credential provisioning before getTenants() can authenticate. No-op for v1. */
  bootstrapCredentials(sbEnvironment: SbEnvironment): Promise<void>;

  /** Registers credentials for tenants discovered by the API but not yet configured. No-op for v1. */
  provisionCredentialsForNewTenants(
    sbEnvironment: SbEnvironment,
    discoveredTenants: TenantDto[]
  ): Promise<void>;
}
```

- [ ] **Step 2: Write the failing test for `V1AdminApiVersionStrategy`**

```typescript
// packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.spec.ts
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getEntityManagerToken } from '@nestjs/typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { AdminApiServiceV1, StartingBlocksServiceV1 } from '../teams/edfi-tenants/starting-blocks';
import { ValidationHttpException } from '../utils';

describe('V1AdminApiVersionStrategy', () => {
  let strategy: V1AdminApiVersionStrategy;
  let edfiTenantsRepository: { find: jest.Mock; save: jest.Mock };
  let entityManager: { transaction: jest.Mock };
  let startingBlocksServiceV1: { saveAdminApiCredentials: jest.Mock };
  let adminApiServiceV1: AdminApiServiceV1;

  beforeEach(async () => {
    edfiTenantsRepository = { find: jest.fn(), save: jest.fn() };
    entityManager = { transaction: jest.fn((cb) => cb({})) };
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `nx test api --testPathPattern=v1-admin-api-version.strategy.spec.ts`
Expected: FAIL — `Cannot find module './v1-admin-api-version.strategy'`

- [ ] **Step 4: Implement `V1AdminApiVersionStrategy`**

This moves `syncv1Environment`, `findOrCreateTenant`, `syncTenantDataV1`,
`createODSObjectV1`, `saveSyncableOdsV1`, and the v1 slice of `createClientCredentials`
out of `SbEnvironmentsEdFiService` verbatim.

```typescript
// packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { EdorgType, PostSbEnvironmentDto, PostSbEnvironmentTenantDTO, SbV1MetaOds } from '@edanalytics/models';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';
import { AdminApiServiceV1, StartingBlocksServiceV1 } from '../teams/edfi-tenants/starting-blocks';
import { persistSyncTenant, SyncableOds } from '../sb-sync/sync-ods';
import { ValidationHttpException } from '../utils';
import { AdminApiVersionStrategy, BuildConfigPublicInput, DispatchSyncResult } from './admin-api-version-strategy.interface';

@Injectable()
export class V1AdminApiVersionStrategy implements AdminApiVersionStrategy {
  readonly version = 'v1' as const;
  readonly supportsMultiTenant = false;
  private readonly logger = new Logger(V1AdminApiVersionStrategy.name);

  constructor(
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly startingBlocksServiceV1: StartingBlocksServiceV1,
    @InjectRepository(EdfiTenant)
    private readonly edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}

  getAdminApiService() {
    return this.adminApiServiceV1;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: 'v1' as const,
      values: {
        edfiHostname: createSbEnvironmentDto.odsApiDiscoveryUrl,
        adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      },
    } as any;
  }

  applyOdsUrlUpdate(_existingConfigPublic: unknown, newOdsApiDiscoveryUrl: string) {
    return { edfiHostname: newOdsApiDiscoveryUrl };
  }

  getTenantModeDefault(): boolean {
    return false; // v1 is always single-tenant
  }

  shouldTriggerResync(): boolean {
    return false; // handled by updateEnvironment()'s own v1 credential-recreation branch
  }

  getRegistrationHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/x-www-form-urlencoded' };
  }

  async bootstrapCredentials(): Promise<void> {
    // no-op: v1 credentials are created synchronously in dispatchSync(), never bootstrapped mid-sync
  }

  async provisionCredentialsForNewTenants(): Promise<void> {
    // no-op: v1 is single-tenant, there is no "newly discovered tenant" concept
  }

  async dispatchSync(
    sbEnvironment: SbEnvironment,
    createSbEnvironmentDto?: PostSbEnvironmentDto
  ): Promise<DispatchSyncResult> {
    if (!createSbEnvironmentDto) {
      throw new Error('V1AdminApiVersionStrategy.dispatchSync requires createSbEnvironmentDto');
    }
    if (!createSbEnvironmentDto.tenants || createSbEnvironmentDto.tenants.length === 0) {
      throw new ValidationHttpException({
        field: 'tenants',
        message: 'At least one tenant is required for v1 deployment',
      });
    }

    const defaultTenantDto = createSbEnvironmentDto.tenants[0];
    const edfiTenant = await this.findOrCreateTenant(sbEnvironment, defaultTenantDto.name);
    await this.syncTenantDataV1(defaultTenantDto, edfiTenant);

    const { clientId, clientSecret } = await this.createClientCredentials(createSbEnvironmentDto.adminApiUrl);
    await this.startingBlocksServiceV1.saveAdminApiCredentials(sbEnvironment, {
      ClientId: clientId,
      ClientSecret: clientSecret,
      url: createSbEnvironmentDto.adminApiUrl,
    });

    return { kind: 'inline' };
  }

  private async createClientCredentials(
    adminApiUrl: string
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
        headers: this.getRegistrationHeaders(),
      });
      if (!registerResponse.status || registerResponse.status !== 200) {
        throw new Error(`Registration failed! status: ${registerResponse.status}`);
      }
      return { clientId, displayName, clientSecret };
    } catch (error) {
      this.logger.error('Failed to register client credentials:', error);
      throw new ValidationHttpException({
        field: 'adminApiUrl',
        message: error.message,
      });
    }
  }

  private async findOrCreateTenant(sbEnvironment: SbEnvironment, tenantName: string): Promise<EdfiTenant> {
    const existingTenants = await this.edfiTenantsRepository.find({
      where: { sbEnvironmentId: sbEnvironment.id },
    });
    if (existingTenants.length === 0) {
      return this.edfiTenantsRepository.save({
        name: tenantName,
        sbEnvironmentId: sbEnvironment.id,
      } as EdfiTenant);
    }
    return existingTenants[0];
  }

  private async syncTenantDataV1(tenantDto: PostSbEnvironmentTenantDTO, tenantEntity: EdfiTenant) {
    const metaOds = this.createODSObjectV1(tenantDto);
    await this.saveSyncableOdsV1(metaOds, tenantEntity);
  }

  private createODSObjectV1(tenant: PostSbEnvironmentTenantDTO): SbV1MetaOds[] {
    return (
      tenant.odss?.map((ods) => ({
        id: ods.id,
        name: ods.name,
        dbname: ods.dbName,
        edorgs: ods.allowedEdOrgs
          ?.split(',')
          .map((id) => id.trim())
          .filter((edorg) => edorg !== '' && !isNaN(Number(edorg)))
          .map((edorg) => ({
            educationorganizationid: parseInt(edorg),
            nameofinstitution: `Institution #${edorg}`,
            shortnameofinstitution: `I#${edorg}`,
            id: parseInt(edorg),
            discriminator: EdorgType['edfi.Other'],
          })),
      })) || []
    );
  }

  private async saveSyncableOdsV1(
    metaOds: SbV1MetaOds[],
    tenantEntity: { name: string; sbEnvironmentId: number } & EdfiTenant
  ) {
    const odss = (metaOds ?? []).map(
      (o): SyncableOds => ({
        id: o.id ?? null,
        name: o.name ?? o.dbname,
        dbName: o.dbname,
        edorgs: o.edorgs,
      })
    );
    await this.entityManager.transaction((em) => persistSyncTenant({ em, odss, edfiTenant: tenantEntity }));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `nx test api --testPathPattern=v1-admin-api-version.strategy.spec.ts`
Expected: PASS (all cases green)

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/admin-api-version-strategy/admin-api-version-strategy.interface.ts packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.ts packages/api/src/admin-api-version-strategy/v1-admin-api-version.strategy.spec.ts
git commit -m "feat(AC-526): add AdminApiVersionStrategy interface and V1 strategy"
```

Next: [526-plan-02-strategy-v2.md](./526-plan-02-strategy-v2.md).
