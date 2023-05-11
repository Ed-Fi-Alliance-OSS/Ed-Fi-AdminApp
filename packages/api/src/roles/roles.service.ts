import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostRoleDto,
  PutRoleDto,
  RoleType,
} from '@edanalytics/models';
import { IsNull, Not, Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { Role } from '@edanalytics/models-server';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>
  ) {}

  create(createRoleDto: PostRoleDto) {
    return this.rolesRepository.save(
      this.rolesRepository.create(createRoleDto)
    );
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
    return this.rolesRepository.save({ ...old, ...updateRoleDto });
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
