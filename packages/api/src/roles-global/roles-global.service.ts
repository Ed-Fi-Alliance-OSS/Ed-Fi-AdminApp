import { GetUserDto, PostRoleDto, PutRoleDto, RoleType } from '@edanalytics/models';
import {
  Ownership,
  Privilege,
  Role,
  User,
  UserTenantMembership,
  regarding,
} from '@edanalytics/models-server';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { EntityManager, In, Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { WorkflowFailureException } from '../utils/customExceptions';
import { StatusType, joinStrsNice } from '@edanalytics/utils';
import { CheckAbilityType } from '../auth/authorization';

@Injectable()
export class RolesGlobalService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    @InjectRepository(Privilege)
    private privilegesRepository: Repository<Privilege>,
    @InjectRepository(UserTenantMembership)
    private utmRepository: Repository<UserTenantMembership>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}
  async create(createRoleDto: PostRoleDto) {
    const uniqueReqPrivileges = _.uniq(createRoleDto.privileges);
    const validPrivileges = await this.privilegesRepository.findBy({
      code: In(createRoleDto.privileges),
    });
    if (validPrivileges.length !== uniqueReqPrivileges.length) {
      throw new BadRequestException('Invalid privileges');
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

  async remove(id: number, user: GetUserDto, force?: false): Promise<undefined>;
  async remove(
    id: number,
    user: GetUserDto,
    force: boolean,
    checkAbility: CheckAbilityType
  ): Promise<undefined>;
  async remove(id: number, user: GetUserDto, force = false, checkAbility?: CheckAbilityType) {
    const old = await this.findOne(id).catch(throwNotFound);
    const memberships = await this.utmRepository.findBy({ roleId: id });
    const users = await this.usersRepository.findBy({ roleId: id });
    const ownerships = await this.ownershipsRepository.findBy({ roleId: id });

    if (!force) {
      if (memberships.length || ownerships.length || users.length) {
        throw new WorkflowFailureException(
          {
            status: StatusType.error,
            title: 'Oops, it looks like this role is still being used.',
            message: `It's currently applied to one or more ${joinStrsNice([
              ...(memberships.length ? ['memberships'] : []),
              ...(users.length ? ['users'] : []),
              ...(ownerships.length ? ['ownerships'] : []),
            ])}.`,
            regarding: regarding(old),
          },
          'REQUIRES_FORCE_DELETE'
        );
      }
    } else {
      const unauthorizedFks: string[] = [];
      if (
        users.length &&
        !checkAbility({
          privilege: 'user:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('users');
      }
      if (
        memberships.length &&
        !checkAbility({
          privilege: 'user-tenant-membership:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('tenant memberships');
      }
      if (
        ownerships.length &&
        !checkAbility({
          privilege: 'ownership:update',
          subject: {
            id: '__filtered__',
          },
        })
      ) {
        unauthorizedFks.push('resource ownerships');
      }

      if (unauthorizedFks.length) {
        throw new WorkflowFailureException({
          status: StatusType.error,
          title: 'Insufficient privileges for force delete',
          message: `You don't have permission to delete this role because it's still being used by ${joinStrsNice(
            unauthorizedFks
          )} and you lack the privileges necessary to modify those.`,
        });
      }
    }
    await this.rolesRepository.remove(old);
    return undefined;
  }
}
