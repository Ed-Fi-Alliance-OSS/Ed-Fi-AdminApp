import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { UserTeamMembership } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound } from '../utils';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';

@Injectable()
export class UserTeamMembershipsGlobalService {
  constructor(
    @InjectRepository(UserTeamMembership)
    private userTeamMembershipsRepository: Repository<UserTeamMembership>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly privilegeGrantGuard: PrivilegeGrantGuardService
  ) {}
  async create(createUserTeamMembershipDto: PostUserTeamMembershipDto, actorId: number) {
    await this.privilegeGrantGuard.assertCanAssignRole(actorId, createUserTeamMembershipDto.roleId, {
      kind: 'team-membership',
      teamId: createUserTeamMembershipDto.teamId,
    });
    // Build from explicit scalars only: relation keys left in the body (e.g. `role`, `team`)
    // would otherwise override the checked FK columns on save.
    return this.userTeamMembershipsRepository.save(
      this.userTeamMembershipsRepository.create({
        teamId: createUserTeamMembershipDto.teamId,
        userId: createUserTeamMembershipDto.userId,
        roleId: createUserTeamMembershipDto.roleId,
        createdById: createUserTeamMembershipDto.createdById,
      })
    );
  }

  async findOne(id: number) {
    return this.userTeamMembershipsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateUserTeamMembershipDto: PutUserTeamMembershipDto, actorId: number) {
    const old = await this.findOne(id);
    const nextRoleId = Object.prototype.hasOwnProperty.call(updateUserTeamMembershipDto, 'roleId')
      ? updateUserTeamMembershipDto.roleId
      : old.roleId;
    await this.privilegeGrantGuard.assertCanAssignRole(
      actorId,
      nextRoleId,
      { kind: 'team-membership', teamId: old.teamId },
      old.roleId ?? null
    );
    const updated = applyDtoUpdates(old, updateUserTeamMembershipDto, ['roleId', 'modifiedById']);
    return this.userTeamMembershipsRepository.save(updated);
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.userTeamMembershipsRepository.remove(old);
    return undefined;
  }
}
