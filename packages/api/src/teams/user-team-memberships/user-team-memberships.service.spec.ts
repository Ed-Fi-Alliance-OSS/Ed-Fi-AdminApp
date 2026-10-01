import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserTeamMembership } from '@edanalytics/models-server';
import { PostUserTeamMembershipDto } from '@edanalytics/models';
import { UserTeamMembershipsService } from './user-team-memberships.service';

const mockRepo = {
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn(async (entity) => ({ ...entity, id: entity.id ?? 100 })),
};

describe('UserTeamMembershipsService', () => {
  let service: UserTeamMembershipsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTeamMembershipsService,
        { provide: getRepositoryToken(UserTeamMembership), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(UserTeamMembershipsService);
  });

  it('create() saves a new membership', async () => {
    const dto: PostUserTeamMembershipDto = { userId: 5, teamId: 1, roleId: 2 };
    const result = await service.create(dto);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ id: 100, userId: 5, teamId: 1, roleId: 2 });
  });

  it('create() never passes an injected id through, so save() cannot overwrite another team\'s membership', async () => {
    // Shape the controller sends: body spread with the route teamId (AC-642).
    const dto = { id: 7, userId: 5, roleId: 2, teamId: 1 } as PostUserTeamMembershipDto;

    await service.create(dto);

    expect(mockRepo.create).toHaveBeenCalledWith({ userId: 5, roleId: 2, teamId: 1 });
    expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty('id');
  });
});
