# Phase 3: `V3AdminApiVersionStrategy` + `AdminApiVersionStrategyFactory`

> Part of the AC-526 implementation plan — see
> [526-plan-00-overview.md](./526-plan-00-overview.md) for goal, architecture, and global
> constraints. Previous phase: [526-plan-02-strategy-v2.md](./526-plan-02-strategy-v2.md).
> Next phase: [526-plan-04-wire-create.md](./526-plan-04-wire-create.md).

## Task 3: `V3AdminApiVersionStrategy`

**Files:**
- Create: `packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.ts`
- Test: `packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.spec.ts`

**Interfaces:**
- Consumes: `V2AdminApiVersionStrategy` (Phase 2), `AdminApiServiceV3`.
- Produces: `V3AdminApiVersionStrategy` class.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.spec.ts
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';

describe('V3AdminApiVersionStrategy', () => {
  let strategy: V3AdminApiVersionStrategy;
  let adminApiServiceV3: AdminApiServiceV3;

  beforeEach(async () => {
    adminApiServiceV3 = {} as AdminApiServiceV3;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        V3AdminApiVersionStrategy,
        { provide: AdminApiServiceV3, useValue: adminApiServiceV3 },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: getRepositoryToken(SbEnvironment), useValue: { findOne: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    strategy = module.get(V3AdminApiVersionStrategy);
  });

  it('reports version "v3" and multi-tenant support (inherited from V2)', () => {
    expect(strategy.version).toBe('v3');
    expect(strategy.supportsMultiTenant).toBe(true);
  });

  it('getAdminApiService returns the injected AdminApiServiceV3 (not V2)', () => {
    expect(strategy.getAdminApiService()).toBe(adminApiServiceV3);
  });

  it('buildConfigPublic returns a v3-tagged configPublic with the same meta shape as v2', () => {
    const result: any = strategy.buildConfigPublic({
      createSbEnvironmentDto: {
        startingBlocks: false,
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        environmentLabel: 'my-v3-env',
      } as any,
      odsApiMetaResponse: { version: '5.3' },
      tenantMode: 'MultiTenant',
    });

    expect(result.version).toBe('v3');
    expect(result.values.meta).toEqual({
      envlabel: 'my-v3-env',
      mode: 'MultiTenant',
      domainName: 'https://ods.test.com',
      adminApiUrl: 'https://api.test.com',
      tenantManagementFunctionArn: '',
      tenantResourceTreeFunctionArn: '',
      odsManagementFunctionArn: '',
      edorgManagementFunctionArn: '',
      dataFreshnessFunctionArn: '',
    });
  });

  it('inherits getRegistrationHeaders behavior from V2 (tenant header rule)', () => {
    expect(strategy.getRegistrationHeaders(true, 'tenant-a')).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      tenant: 'tenant-a',
    });
  });

  it('inherits getTenantModeDefault behavior from V2', () => {
    const env = {
      configPublic: { version: 'v3', values: { meta: { mode: 'MultiTenant' } } },
    } as unknown as SbEnvironment;
    expect(strategy.getTenantModeDefault(env)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nx test api --testPathPattern=v3-admin-api-version.strategy.spec.ts`
Expected: FAIL — `Cannot find module './v3-admin-api-version.strategy'`

- [ ] **Step 3: Implement `V3AdminApiVersionStrategy`**

```typescript
// packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { SbV3MetaEnv } from '@edanalytics/models';
import { randomUUID } from 'crypto';
import { AdminApiServiceV3 } from '../teams/edfi-tenants/starting-blocks';
import { IJobQueueService } from '../sb-sync/job-queue/job-queue.interface';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { BuildConfigPublicInput } from './admin-api-version-strategy.interface';

@Injectable()
export class V3AdminApiVersionStrategy extends V2AdminApiVersionStrategy {
  readonly version: 'v1' | 'v2' | 'v3' = 'v3';

  constructor(
    private readonly adminApiServiceV3: AdminApiServiceV3,
    @Inject('IJobQueueService')
    jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue)
    queueRepository: Repository<SbSyncQueue>,
    @InjectRepository(SbEnvironment)
    sbEnvironmentsRepository: Repository<SbEnvironment>
  ) {
    // V2's constructor takes AdminApiServiceV2; V3 never uses `this.adminApiServiceV2`
    // because getAdminApiService() is overridden below, so passing `undefined` is safe.
    super(undefined as never, jobQueue, queueRepository, sbEnvironmentsRepository);
  }

  getAdminApiService() {
    return this.adminApiServiceV3;
  }

  buildConfigPublic({ createSbEnvironmentDto, odsApiMetaResponse, tenantMode }: BuildConfigPublicInput) {
    return {
      startingBlocks: createSbEnvironmentDto.startingBlocks,
      odsApiMeta: odsApiMetaResponse,
      adminApiUrl: createSbEnvironmentDto.adminApiUrl,
      version: 'v3' as const,
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
        } satisfies SbV3MetaEnv,
        adminApiUuid: randomUUID(),
      },
    } as any;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nx test api --testPathPattern=v3-admin-api-version.strategy.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.ts packages/api/src/admin-api-version-strategy/v3-admin-api-version.strategy.spec.ts
git commit -m "feat(AC-526): add V3AdminApiVersionStrategy extending V2"
```

## Task 4: `AdminApiVersionStrategyFactory`

**Files:**
- Create: `packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.ts`
- Create: `packages/api/src/admin-api-version-strategy/index.ts`
- Test: `packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.spec.ts`
- Modify: `packages/api/src/app/services.module.ts`

**Interfaces:**
- Consumes: `V1AdminApiVersionStrategy`, `V2AdminApiVersionStrategy`,
  `V3AdminApiVersionStrategy` (Phases 1–3).
- Produces: `AdminApiVersionStrategyFactory.getStrategy(version: string | undefined):
  AdminApiVersionStrategy` — throws for anything outside `'v1'|'v2'|'v3'`. Consumed by
  Phases 4–6.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.spec.ts
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminApiVersionStrategyFactory } from './admin-api-version-strategy.factory';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';

describe('AdminApiVersionStrategyFactory', () => {
  let factory: AdminApiVersionStrategyFactory;
  let v1: V1AdminApiVersionStrategy;
  let v2: V2AdminApiVersionStrategy;
  let v3: V3AdminApiVersionStrategy;

  beforeEach(async () => {
    v1 = { version: 'v1' } as V1AdminApiVersionStrategy;
    v2 = { version: 'v2' } as V2AdminApiVersionStrategy;
    v3 = { version: 'v3' } as V3AdminApiVersionStrategy;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApiVersionStrategyFactory,
        { provide: V1AdminApiVersionStrategy, useValue: v1 },
        { provide: V2AdminApiVersionStrategy, useValue: v2 },
        { provide: V3AdminApiVersionStrategy, useValue: v3 },
      ],
    }).compile();

    factory = module.get(AdminApiVersionStrategyFactory);
  });

  it('resolves each known version to its strategy', () => {
    expect(factory.getStrategy('v1')).toBe(v1);
    expect(factory.getStrategy('v2')).toBe(v2);
    expect(factory.getStrategy('v3')).toBe(v3);
  });

  it('throws for an unknown or missing version', () => {
    expect(() => factory.getStrategy('v4' as any)).toThrow('Invalid API version: v4');
    expect(() => factory.getStrategy(undefined)).toThrow('Invalid API version: undefined');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `nx test api --testPathPattern=admin-api-version-strategy.factory.spec.ts`
Expected: FAIL — `Cannot find module './admin-api-version-strategy.factory'`

- [ ] **Step 3: Implement the factory and barrel file**

```typescript
// packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.ts
import { Injectable } from '@nestjs/common';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';
import { AdminApiVersionStrategy } from './admin-api-version-strategy.interface';

@Injectable()
export class AdminApiVersionStrategyFactory {
  constructor(
    private readonly v1Strategy: V1AdminApiVersionStrategy,
    private readonly v2Strategy: V2AdminApiVersionStrategy,
    private readonly v3Strategy: V3AdminApiVersionStrategy
  ) {}

  getStrategy(version: string | undefined): AdminApiVersionStrategy {
    switch (version) {
      case 'v1':
        return this.v1Strategy;
      case 'v2':
        return this.v2Strategy;
      case 'v3':
        return this.v3Strategy;
      default:
        throw new Error(`Invalid API version: ${version}`);
    }
  }
}
```

```typescript
// packages/api/src/admin-api-version-strategy/index.ts
export * from './admin-api-version-strategy.interface';
export * from './v1-admin-api-version.strategy';
export * from './v2-admin-api-version.strategy';
export * from './v3-admin-api-version.strategy';
export * from './admin-api-version-strategy.factory';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `nx test api --testPathPattern=admin-api-version-strategy.factory.spec.ts`
Expected: PASS

- [ ] **Step 5: Register the new providers in `services.module.ts`**

In `packages/api/src/app/services.module.ts`, add the import and register the four new
providers:

```typescript
// add to the existing import block near the top of the file
import {
  AdminApiVersionStrategyFactory,
  V1AdminApiVersionStrategy,
  V2AdminApiVersionStrategy,
  V3AdminApiVersionStrategy,
} from '../admin-api-version-strategy';
```

```typescript
// inside the `providers` array, alongside the existing AdminApiService* entries
  AdminApiVersionStrategyFactory,
  V1AdminApiVersionStrategy,
  V2AdminApiVersionStrategy,
  V3AdminApiVersionStrategy,
```

- [ ] **Step 6: Run the full API test suite to confirm nothing else broke**

Run: `nx test api`
Expected: PASS (all existing suites unaffected — nothing consumes the factory yet)

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.ts packages/api/src/admin-api-version-strategy/admin-api-version-strategy.factory.spec.ts packages/api/src/admin-api-version-strategy/index.ts packages/api/src/app/services.module.ts
git commit -m "feat(AC-526): add AdminApiVersionStrategyFactory and register providers"
```

Next: [526-plan-04-wire-create.md](./526-plan-04-wire-create.md).
