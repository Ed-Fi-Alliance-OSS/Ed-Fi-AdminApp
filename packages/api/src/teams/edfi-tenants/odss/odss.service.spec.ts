import 'reflect-metadata';
import { EdfiTenant, Edorg, Ods, SbEnvironment, SbSyncQueue } from '@edanalytics/models-server';
import { PostOdsDto } from '@edanalytics/models';
import { NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { OdssService } from './odss.service';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { OdsRowCountService } from '../starting-blocks/v2/ods-rowcount.service';

const mockOdssRepository = () => ({
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
});

const mockEdorgsRepository = () => ({
  findBy: jest.fn(),
  save: jest.fn(),
});

describe('OdssService', () => {
  let service: OdssService;
  let odssRepository: ReturnType<typeof mockOdssRepository>;
  let edorgsRepository: ReturnType<typeof mockEdorgsRepository>;
  let startingBlocksServiceV2: Partial<StartingBlocksServiceV2>;
  let syncQueueRepository: { findOneBy: jest.Mock };

  const mockSbEnvironment: Partial<SbEnvironment> = { id: 1, version: 'v2' };
  const mockEdfiTenant: Partial<EdfiTenant> = { id: 10, sbEnvironmentId: 1, name: 'test-tenant' };

  beforeEach(() => {
    odssRepository = mockOdssRepository();
    edorgsRepository = mockEdorgsRepository();
    syncQueueRepository = { findOneBy: jest.fn() };
    startingBlocksServiceV2 = {
      odsRowCountService: { rowCount: jest.fn() } as unknown as OdsRowCountService,
    };

    service = new OdssService(
      odssRepository as unknown as Repository<Ods>,
      edorgsRepository as unknown as Repository<Edorg>,
      startingBlocksServiceV2 as StartingBlocksServiceV2,
      syncQueueRepository as unknown as Repository<SbSyncQueue>
    );

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('uses dto.templateName in odss create flow', async () => {
      const dto = {
        name: 'ODS One',
        templateName: 'TemplateNameValue',
        databaseTemplate: 'DatabaseTemplateValue',
      } as PostOdsDto;
      const sbEnvironment = {
        ...mockSbEnvironment,
        startingBlocks: false,
      } as SbEnvironment;
      const createdOds = { id: 1, odsInstanceName: 'ODS One' };

      startingBlocksServiceV2.createOds = jest
        .fn()
        .mockResolvedValue({ status: 'SUCCESS' });
      odssRepository.findOneBy.mockResolvedValue(createdOds);

      await service.create(sbEnvironment, mockEdfiTenant as EdfiTenant, dto);

      expect(startingBlocksServiceV2.createOds).toHaveBeenCalledWith(
        sbEnvironment,
        mockEdfiTenant,
        'ODS One',
        'TemplateNameValue'
      );
    });
  });

  describe('findOdsManageJob', () => {
    const job = (over: Record<string, unknown> = {}) => ({
      id: 'job-1',
      type: 'OdsManage',
      edfiTenantId: 10,
      data: { operation: 'create' },
      ...over,
    });

    it('returns the job for matching tenant and operation', async () => {
      const row = job();
      syncQueueRepository.findOneBy.mockResolvedValue(row);
      await expect(service.findOdsManageJob(10, 'job-1', 'create')).resolves.toBe(row);
      expect(syncQueueRepository.findOneBy).toHaveBeenCalledWith({ id: 'job-1' });
    });

    it('matches operation when data arrives as a JSON string', async () => {
      const row = job({ data: JSON.stringify({ operation: 'delete' }) });
      syncQueueRepository.findOneBy.mockResolvedValue(row);
      await expect(service.findOdsManageJob(10, 'job-1', 'delete')).resolves.toBe(row);
    });

    it('404 for a job in another tenant', async () => {
      syncQueueRepository.findOneBy.mockResolvedValue(job({ edfiTenantId: 99 }));
      await expect(service.findOdsManageJob(10, 'job-1', 'create')).rejects.toThrow(NotFoundException);
    });

    it('404 for an sbe-sync (SbEnvironment) job id', async () => {
      syncQueueRepository.findOneBy.mockResolvedValue(job({ type: 'SbEnvironment' }));
      await expect(service.findOdsManageJob(10, 'job-1', 'create')).rejects.toThrow(NotFoundException);
    });

    it('404 when operation does not match (delete job via create endpoint)', async () => {
      syncQueueRepository.findOneBy.mockResolvedValue(job({ data: { operation: 'delete' } }));
      await expect(service.findOdsManageJob(10, 'job-1', 'create')).rejects.toThrow(NotFoundException);
    });

    it('404 when the lookup fails with a query error (e.g. non-UUID id on pgsql)', async () => {
      syncQueueRepository.findOneBy.mockRejectedValue(
        new QueryFailedError('select', ['x'], new Error('invalid input syntax for type uuid: "x"'))
      );
      await expect(service.findOdsManageJob(10, 'x', 'create')).rejects.toThrow(NotFoundException);
    });

    it('rethrows unexpected non-query errors', async () => {
      syncQueueRepository.findOneBy.mockRejectedValue(new Error('connection lost'));
      await expect(service.findOdsManageJob(10, 'job-1', 'create')).rejects.toThrow('connection lost');
    });

    it('404 for an unknown id', async () => {
      syncQueueRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOdsManageJob(10, 'nope', 'create')).rejects.toThrow(NotFoundException);
    });
  });
});
