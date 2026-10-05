import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserTeamMembership } from '@edanalytics/models-server';
import { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { createGlobalValidationPipe } from '../../app/global-validation-pipe';
import { UserTeamMembershipsController } from './user-team-memberships.controller';
import { UserTeamMembershipsService } from './user-team-memberships.service';

/**
 * Drives the AC-642 cross-team attack through the real request lifecycle:
 * global ValidationPipe -> controller (route teamId override, addUserCreating)
 * -> service (withoutId) -> repository. Authorization runs in global APP_GUARDs
 * registered in AppModule, so it is out of scope here.
 */
const SESSION_USER_ID = 42;
const SERVER_GENERATED_ID = 500;

const mockRepo = {
  create: jest.fn((entity) => ({ ...entity })),
  save: jest.fn(async (entity) => ({
    ...entity,
    id: entity.id ?? SERVER_GENERATED_ID,
    created: new Date('2026-10-05T00:00:00Z'),
  })),
};

@Module({
  controllers: [UserTeamMembershipsController],
  providers: [
    UserTeamMembershipsService,
    { provide: getRepositoryToken(UserTeamMembership), useValue: mockRepo },
  ],
})
class TeamMembershipsTestModule {}

describe('POST /teams/:teamId/user-team-memberships (AC-642 mass assignment)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [
        TeamMembershipsTestModule,
        RouterModule.register([
          { path: 'teams/:teamId/user-team-memberships', module: TeamMembershipsTestModule },
        ]),
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = { id: SESSION_USER_ID };
      next();
    });
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('ignores an injected id and body teamId, so another team\'s membership cannot be overwritten', async () => {
    const attackerTeamId = 5;
    const maliciousBody = {
      id: 7, // another team's membership row
      teamId: 99, // a team the caller has no rights on
      userId: 10,
      roleId: 3,
      createdById: 1,
      modifiedById: 1,
    };

    const response = await request(app.getHttpServer())
      .post(`/teams/${attackerTeamId}/user-team-memberships`)
      .send(maliciousBody)
      .expect(201);

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith({
      teamId: attackerTeamId,
      userId: 10,
      roleId: 3,
      createdById: SESSION_USER_ID,
    });
    expect(mockRepo.save.mock.calls[0][0]).not.toHaveProperty('id');

    expect(response.body).toMatchObject({
      id: SERVER_GENERATED_ID,
      teamId: attackerTeamId,
      userId: 10,
      roleId: 3,
      createdById: SESSION_USER_ID,
    });
  });

  it('rejects non-numeric ids at validation, before the controller runs', async () => {
    await request(app.getHttpServer())
      .post('/teams/5/user-team-memberships')
      .send({ id: 'other-team-membership', teamId: 'attacker-team', userId: 'victim' })
      .expect(400);

    expect(mockRepo.create).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
