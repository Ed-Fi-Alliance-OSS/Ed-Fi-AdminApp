import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getEntityManagerToken, getRepositoryToken } from '@nestjs/typeorm';
import { CertificationRun, Team } from '@edanalytics/models-server';
import { PostTeamDto, PutTeamDto, GetUserDto } from '@edanalytics/models';
import { TeamsGlobalService } from './teams-global.service';

const mockTeam = { id: 1, name: 'Engineering', displayName: 'Engineering' };

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...mockTeam, ...entity, id: entity.id ?? 1 })),
  findOneByOrFail: jest.fn(async ({ id }: { id: number }) => {
    if (id === 1) return { ...mockTeam };
    throw new Error('Not found');
  }),
  remove: jest.fn(async () => undefined),
};

const transactionTeams = { remove: jest.fn(async () => undefined) };
const certificationRuns = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
const transactionalManager = {
  getRepository: jest.fn((entity) => {
    if (entity === Team) return transactionTeams;
    if (entity === CertificationRun) return certificationRuns;
    throw new Error('Unexpected transaction repository');
  }),
};
const entityManager = {
  transaction: jest.fn(async (work) => work(transactionalManager)),
};

describe('TeamsGlobalService', () => {
  let service: TeamsGlobalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsGlobalService,
        { provide: getRepositoryToken(Team), useValue: mockRepo },
        { provide: getEntityManagerToken(), useValue: entityManager },
      ],
    }).compile();
    service = module.get(TeamsGlobalService);
  });

  it('create() saves a new team', async () => {
    const dto = { name: 'Science' } as PostTeamDto;
    await service.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('findOne() returns a team by id', async () => {
    const result = await service.findOne(1);
    expect(result).toMatchObject({ id: 1, name: 'Engineering' });
    expect(mockRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
  });

  it('findOne() throws when not found', async () => {
    await expect(service.findOne(999)).rejects.toThrow();
  });

  it('update() applies allowed fields and saves', async () => {
    const dto = { name: 'Infra' } as PutTeamDto;
    await service.update(1, dto);
    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = mockRepo.save.mock.calls[0][0];
    expect(savedArg.name).toBe('Infra');
  });

  it('remove() removes the team and returns undefined', async () => {
    const result = await service.remove(1, { id: 99 } as GetUserDto);
    expect(certificationRuns.update).toHaveBeenCalledWith({ teamId: 1 }, { teamId: null });
    expect(transactionTeams.remove).toHaveBeenCalledWith(mockTeam);
    expect(certificationRuns.update.mock.invocationCallOrder[0]).toBeLessThan(
      transactionTeams.remove.mock.invocationCallOrder[0],
    );
    expect(entityManager.transaction).toHaveBeenCalledTimes(1);
    expect(mockRepo.remove).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does not remove the team if detaching its certification runs fails', async () => {
    certificationRuns.update.mockRejectedValueOnce(new Error('Detachment failed'));

    await expect(service.remove(1, { id: 99 } as GetUserDto)).rejects.toThrow('Detachment failed');

    expect(transactionTeams.remove).not.toHaveBeenCalled();
    expect(mockRepo.remove).not.toHaveBeenCalled();
  });

  it('remove() throws NotFoundException when team not found', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(service.remove(999, { id: 1 } as GetUserDto)).rejects.toThrow(NotFoundException);
    expect(entityManager.transaction).not.toHaveBeenCalled();
  });
});
