import { GetUserDto, PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import { Privilege, Role } from '@edanalytics/models-server';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { EntityManager, In, Repository } from 'typeorm';

@Injectable()
export class RolesGlobalService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(Privilege)
    private privilegesRepository: Repository<Privilege>
  ) {}
  async create(createRoleDto: PostRoleDto) {
    const uniqueReqPrivileges = _.uniq(createRoleDto.privileges);
    const validPrivileges = await this.privilegesRepository.findBy({
      code: In(createRoleDto.privileges),
    });
    if (validPrivileges.length !== uniqueReqPrivileges.length) {
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
      privileges: validPrivileges,
    });
  }

  async findOne(id: number) {
    return this.rolesRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateRoleDto: PutRoleDto) {
    const old = await this.findOne(id);
    const uniqueReqPrivileges = _.uniq(updateRoleDto.privileges);
    const newPrivileges = await this.privilegesRepository.findBy({
      code: In(updateRoleDto.privileges),
    });
    if (newPrivileges.length !== uniqueReqPrivileges.length) {
      throw new BadRequestException('Invalid privileges');
    }
    return this.rolesRepository.save({
      ...old,
      name: updateRoleDto.name,
      description: updateRoleDto.description,
      privileges: newPrivileges,
    });
  }

  async remove(id: number, user: GetUserDto) {
    const old = await this.findOne(id);
    await this.rolesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
