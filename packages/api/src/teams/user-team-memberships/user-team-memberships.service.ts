import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound, withoutId } from '../../utils';
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
    return this.userTeamMembershipsRepository.save(
      this.userTeamMembershipsRepository.create(withoutId(createUserTeamMembershipDto))
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
