import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import { In, IsNull, Not, Repository } from 'typeorm';
import { throwNotFound } from '../../utils';
import { Privilege, Role } from '@edanalytics/models-server';
import _ from 'lodash';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Privilege)
    private privilegesRepository: Repository<Privilege>
  ) {}

  async create(createRoleDto: PostRoleDto) {
    const uniqueReqPrivileges = _.uniq(createRoleDto.privileges);
    const privileges = await this.privilegesRepository.findBy({
      code: In(createRoleDto.privileges),
    });
    if (privileges.length !== uniqueReqPrivileges.length) {
      throw new BadRequestException('Invalid privileges');
    }
    if (createRoleDto.type !== RoleType.UserTenant) {
      throw new BadRequestException(
        `Attempting to update invalid role type (${createRoleDto.type})`
      );
    }
    return this.rolesRepository.save({
      tenantId: createRoleDto.tenantId,
      type: createRoleDto.type,
      name: createRoleDto.name,
      description: createRoleDto.description,
      privileges: privileges,
    });
  }

  findAll(tenantId: number) {
    return this.rolesRepository.findBy([
      {
        tenantId,
        type: Not(RoleType.UserGlobal),
      },
      {
        tenantId: IsNull(),
        type: Not(RoleType.UserGlobal),
      },
    ]);
  }

  findOne(tenantId: number, id: number) {
    return this.rolesRepository
      .findOneByOrFail([
        {
          tenantId,
          type: Not(RoleType.UserGlobal),
          id,
        },
        {
          tenantId: IsNull(),
          type: Not(RoleType.UserGlobal),
          id,
        },
      ])
      .catch(throwNotFound);
  }

  async update(tenantId: number, id: number, updateRoleDto: PutRoleDto) {
    const old = await this.findOne(tenantId, id);
    const uniqueReqPrivileges = _.uniq(updateRoleDto.privileges);
    const newPrivileges = await this.privilegesRepository.findBy({
      code: In(updateRoleDto.privileges),
    });
    if (newPrivileges.length !== uniqueReqPrivileges.length) {
      throw new BadRequestException('Invalid privileges');
    }
    if (old.type !== RoleType.UserTenant) {
      throw new BadRequestException(`Attempting to update invalid role type (${old.type})`);
    }
    return this.rolesRepository.save({
      ...old,
      name: updateRoleDto.name,
      description: updateRoleDto.description,
      privileges: newPrivileges,
    });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.rolesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
