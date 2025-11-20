import { PRIVILEGES, PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import { Role } from '@edanalytics/models-server';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { IsNull, Not, Repository } from 'typeorm';
import { throwNotFound } from '../../utils';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>
  ) {}

  async create(createRoleDto: PostRoleDto) {
    const uniqueReqPrivileges = _.uniq(createRoleDto.privilegeIds);
    if (uniqueReqPrivileges.some((code) => !PRIVILEGES[code])) {
      throw new BadRequestException('Invalid privileges');
    }
    if (createRoleDto.type !== RoleType.UserTeam) {
      throw new BadRequestException(
        `Attempting to update invalid role type (${createRoleDto.type})`
      );
    }
    return this.rolesRepository.save({
      teamId: createRoleDto.teamId,
      type: createRoleDto.type,
      name: createRoleDto.name,
      description: createRoleDto.description,
      privilegeIds: uniqueReqPrivileges,
    });
  }

  findAll(teamId: number) {
    return this.rolesRepository.findBy([
      {
        teamId: teamId,
        type: Not(RoleType.UserGlobal),
      },
      {
        teamId: IsNull(),
        type: Not(RoleType.UserGlobal),
      },
    ]);
  }

  findOne(teamId: number, id: number) {
    return this.rolesRepository
      .findOneByOrFail([
        {
          teamId: teamId,
          type: Not(RoleType.UserGlobal),
          id,
        },
        {
          teamId: IsNull(),
          type: Not(RoleType.UserGlobal),
          id,
        },
      ])
      .catch(throwNotFound);
  }

  async update(teamId: number, id: number, updateRoleDto: PutRoleDto) {
    const old = await this.rolesRepository.findOneBy({
      id,
    });
    if (old === null) {
      return {
        status: 'NOT_FOUND' as const,
      };
    } else if (old.teamId !== teamId) {
      return {
        status: 'PUBLIC_ROLE' as const,
      };
    } else if (old.type !== RoleType.UserTeam) {
      return {
        status: 'NOT_TEAM_USER_ROLE' as const,
      };
    } else {
      const uniqueReqPrivileges = _.uniq(updateRoleDto.privilegeIds);
      if (uniqueReqPrivileges.some((code) => !PRIVILEGES[code])) {
        return {
          status: 'INVALID_PRIVILEGES' as const,
        };
      }
      return {
        result: await this.rolesRepository.save({
          ...old,
          name: updateRoleDto.name,
          description: updateRoleDto.description,
          privilegeIds: uniqueReqPrivileges,
        }),
        status: 'SUCCESS' as const,
      };
    }
  }
}
