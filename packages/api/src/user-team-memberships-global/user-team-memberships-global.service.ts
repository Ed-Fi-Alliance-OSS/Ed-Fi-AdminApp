import {
  GetUserDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { UserTeamMembership } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound, withoutId } from '../utils';
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
    return this.userTeamMembershipsRepository.save(
      this.userTeamMembershipsRepository.create(withoutId(createUserTeamMembershipDto))
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
