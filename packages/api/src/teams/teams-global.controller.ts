import {
  AuthorizationCache,
  GetSessionDataDto,
  PostTeamDto,
  PutTeamDto,
  toEnvNavDto,
  toGetTeamDto,
} from '@edanalytics/models';
import { EnvNav, Team, addUserCreating, addUserModifying } from '@edanalytics/models-server';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { AuthCache } from '../auth/helpers/inject-auth-cache';
import { ReqUser } from '../auth/helpers/user.decorator';
import { throwNotFound } from '../utils';
import { TeamsGlobalService } from './teams-global.service';

@ApiTags('Team - Global')
@Controller()
export class TeamsGlobalController {
  constructor(
    private readonly teamService: TeamsGlobalService,
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(EnvNav) private readonly envNavRepository: Repository<EnvNav>
  ) {}

  @Post()
  @Authorize({
    privilege: 'team:create',
    subject: {
      id: '__filtered__',
    },
  })
  async create(@Body() createTeamDto: PostTeamDto, @ReqUser() user: GetSessionDataDto) {
    return toGetTeamDto(await this.teamService.create(addUserCreating(createTeamDto, user)));
  }

  @Get()
  @Authorize({
    privilege: 'team:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toGetTeamDto(await this.teamsRepository.find());
  }

  @Get(':teamId')
  @Authorize({
    privilege: 'team:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(@Param('teamId', new ParseIntPipe()) teamId: number) {
    return toGetTeamDto(await this.teamService.findOne(teamId).catch(throwNotFound));
  }

  @Put(':teamId')
  @Authorize({
    privilege: 'team:update',
    subject: {
      id: '__filtered__',
    },
  })
  async update(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Body() updateTeamDto: PutTeamDto,
    @ReqUser() user: GetSessionDataDto
  ) {
    return toGetTeamDto(
      await this.teamService.update(teamId, addUserModifying(updateTeamDto, user))
    );
  }

  @Delete(':teamId')
  @Authorize({
    privilege: 'team:delete',
    subject: {
      id: '__filtered__',
    },
  })
  remove(@Param('teamId', new ParseIntPipe()) teamId: number, @ReqUser() user: GetSessionDataDto) {
    return this.teamService.remove(teamId, user);
  }

  @Authorize({
    privilege: 'team.sb-environment:read',
    subject: {
      teamId: 'teamId',
      id: '__filtered__',
    },
  })
  @Get(':teamId/env-nav')
  async envNav(@AuthCache() authCache: AuthorizationCache) {
    const sbEnvironmentRead = authCache['team.sb-environment:read'];
    if (sbEnvironmentRead === true) {
      return toEnvNavDto((await this.envNavRepository.find()).map(mapEnvNav(authCache)));
    }
    const edfiTenantRead = authCache['team.sb-environment.edfi-tenant:read'] ?? {};
    return toEnvNavDto(
      (
        await this.envNavRepository.find({
          where: [
            {
              sbEnvironmentId: In(
                [...sbEnvironmentRead.values()].filter(
                  // environment item should be displaced by its constituent tenant items
                  (sbEnvironmentId) => !(sbEnvironmentId in edfiTenantRead)
                )
              ),
              edfiTenantId: IsNull(),
            },
            ...Object.entries(edfiTenantRead).map(([sbEnvironmentId, edfiTenantIds]) => ({
              sbEnvironmentId: Number(sbEnvironmentId),
              ...(edfiTenantIds === true
                ? { edfiTenantId: Not(IsNull()) }
                : { edfiTenantId: In([...edfiTenantIds.values()]) }),
            })),
          ],
        })
      ).map(mapEnvNav(authCache))
    );
  }
}
const mapEnvNav = (authCache: AuthorizationCache) => (env: EnvNav) => {
  if (env.edfiTenantId === null) {
    return {
      ...env,
      odss: false,
      edorgs: false,
      vendors: false,
      claimsets: false,
      applications: false,
      profiles: false,
    };
  } else {
    return {
      ...env,
      odss: !!authCache['team.sb-environment.edfi-tenant.ods:read']?.[env.edfiTenantId],
      edorgs: !!authCache['team.sb-environment.edfi-tenant.ods.edorg:read']?.[env.edfiTenantId],
      vendors: !!authCache['team.sb-environment.edfi-tenant.vendor:read']?.[env.edfiTenantId],
      claimsets: !!authCache['team.sb-environment.edfi-tenant.claimset:read']?.[env.edfiTenantId],
      applications:
        !!authCache['team.sb-environment.edfi-tenant.ods.edorg.application:read']?.[
          env.edfiTenantId
        ],
      profiles: !!authCache['team.sb-environment.edfi-tenant.profile:read']?.[env.edfiTenantId],
    };
  }
};
