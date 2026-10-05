import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound } from '../../utils';
import { UserTeamMembership } from '@edanalytics/models-server';
import { PrivilegeGrantGuardService } from '../../auth/authorization/privilege-grant-guard.service';

@Injectable()
export class UserTeamMembershipsService {
  constructor(
    @InjectRepository(UserTeamMembership)
    private userTeamMembershipsRepository: Repository<UserTeamMembership>,
    private readonly privilegeGrantGuard: PrivilegeGrantGuardService
  ) {}

  async create(createUserTeamMembershipDto: PostUserTeamMembershipDto, actorId: number) {
    await this.privilegeGrantGuard.assertCanAssignRole(
      actorId,
      createUserTeamMembershipDto.roleId,
      {
        kind: 'team-membership',
        teamId: createUserTeamMembershipDto.teamId,
      }
    );
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

  findAll(teamId: number) {
    return this.userTeamMembershipsRepository.findBy({
      teamId,
    });
  }

  findOne(teamId: number, id: number) {
    return this.userTeamMembershipsRepository.findOneByOrFail({ teamId, id }).catch(throwNotFound);
  }

  async update(
    teamId: number,
    id: number,
    updateUserTeamMembershipDto: PutUserTeamMembershipDto,
    actorId: number
  ) {
    const old = await this.findOne(teamId, id);
    const nextRoleId = Object.prototype.hasOwnProperty.call(updateUserTeamMembershipDto, 'roleId')
      ? updateUserTeamMembershipDto.roleId
      : old.roleId;
    await this.privilegeGrantGuard.assertCanAssignRole(
      actorId,
      nextRoleId,
      { kind: 'team-membership', teamId },
      old.roleId ?? null
    );
    // Only roleId/modifiedById are updatable; the body must not move the membership.
    const updated = applyDtoUpdates(old, updateUserTeamMembershipDto, ['roleId', 'modifiedById']);
    return this.userTeamMembershipsRepository.save(updated);
  }

  async remove(teamId: number, id: number, _user: GetUserDto) {
    const old = await this.findOne(teamId, id).catch(throwNotFound);
    await this.userTeamMembershipsRepository.remove(old);
    return undefined;
  }
}
