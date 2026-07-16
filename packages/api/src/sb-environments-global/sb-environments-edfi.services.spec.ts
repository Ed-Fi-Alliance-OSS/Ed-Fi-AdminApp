import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import { SbEnvironmentsEdFiService } from './sb-environments-edfi.services';
import { AdminApiVersionStrategyFactory } from '../admin-api-version-strategy';
import { EdfiTenant, SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { StartingBlocksServiceV1, StartingBlocksServiceV2 } from '../teams/edfi-tenants/starting-blocks';
import * as utils from '../utils';

jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  validateAdminApiUrl: jest.fn(),
  fetchOdsApiMetadata: jest.fn(),
}));

describe('SbEnvironmentsEdFiService.create (v3)', () => {
  let service: SbEnvironmentsEdFiService;
  let sbEnvironmentsRepository: { save: jest.Mock; create: jest.Mock };
  let strategyFactory: { getStrategy: jest.Mock };
  let v3Strategy: {
    version: string;
    buildConfigPublic: jest.Mock;
    getRegistrationHeaders: jest.Mock;
    dispatchSync: jest.Mock;
  };

  beforeEach(async () => {
    v3Strategy = {
      version: 'v3',
      buildConfigPublic: jest.fn().mockReturnValue({
        version: 'v3',
        values: { meta: { mode: 'SingleTenant' }, adminApiUuid: 'uuid-1' },
        adminApiUrl: 'https://api.test.com',
      }),
      getRegistrationHeaders: jest.fn().mockReturnValue({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      dispatchSync: jest.fn().mockResolvedValue({ kind: 'queued', syncQueue: { id: 'job-1', state: 'completed' } }),
    };
    strategyFactory = { getStrategy: jest.fn().mockReturnValue(v3Strategy) };

    sbEnvironmentsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 99, ...v })),
    };

    (utils.validateAdminApiUrl as jest.Mock).mockResolvedValue({ specificationVersion: 'v3' });
    (utils.fetchOdsApiMetadata as jest.Mock).mockResolvedValue({
      version: '5.3',
      urls: { dataManagementApi: 'https://ods.test.com/data/v3' },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbEnvironmentsEdFiService,
        { provide: getRepositoryToken(SbEnvironment), useValue: sbEnvironmentsRepository },
        { provide: StartingBlocksServiceV1, useValue: {} },
        { provide: StartingBlocksServiceV2, useValue: {} },
        { provide: getRepositoryToken(EdfiTenant), useValue: { find: jest.fn(), save: jest.fn() } },
        { provide: getEntityManagerToken(), useValue: { transaction: jest.fn() } },
        { provide: 'IJobQueueService', useValue: { send: jest.fn() } },
        { provide: getRepositoryToken(SbSyncQueue), useValue: { findOneBy: jest.fn() } },
        { provide: AdminApiVersionStrategyFactory, useValue: strategyFactory },
      ],
    }).compile();

    service = module.get(SbEnvironmentsEdFiService);
  });

  it('creates a v3 environment, builds a v3-shaped configPublic via the strategy, and returns a syncQueue', async () => {
    const result = await service.create(
      {
        name: 'my-v3-env',
        environmentLabel: 'my-v3-env',
        adminApiUrl: 'https://api.test.com',
        odsApiDiscoveryUrl: 'https://ods.test.com',
        startingBlocks: false,
      } as any,
      undefined
    );

    expect(strategyFactory.getStrategy).toHaveBeenCalledWith('v3');
    expect(v3Strategy.buildConfigPublic).toHaveBeenCalled();
    expect(v3Strategy.dispatchSync).toHaveBeenCalled();
    expect((result as any).syncQueue).toBeDefined();
  });
});
