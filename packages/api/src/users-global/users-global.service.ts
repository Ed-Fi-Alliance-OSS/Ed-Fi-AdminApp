import { GetUserDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { User } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, throwNotFound } from '../utils';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';

@Injectable()
export class UsersGlobalService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly privilegeGrantGuard: PrivilegeGrantGuardService
  ) {}

  async create(createUserDto: PostUserDto, actorId: number) {
    await this.privilegeGrantGuard.assertCanAssignRole(actorId, createUserDto.roleId, {
      kind: 'global-user',
    });
    // Build from explicit scalars only: relation keys left in the body (e.g. `role`) would
    // otherwise override the checked roleId on save.
    return this.usersRepository.save(
      this.usersRepository.create({
        username: createUserDto.username,
        userType: createUserDto.userType,
        roleId: createUserDto.roleId,
        isActive: createUserDto.isActive,
        givenName: createUserDto.givenName,
        familyName: createUserDto.familyName,
        clientId: createUserDto.clientId,
        description: createUserDto.description,
        createdById: createUserDto.createdById,
      })
    );
  }

  async findOne(id: number) {
    return this.usersRepository.findOneByOrFail({ id });
  }

  async findByUsername(username: string) {
    return this.usersRepository.findOneByOrFail({ username });
  }

  async update(id: number, updateUserDto: PutUserDto, actorId: number) {
    const old = await this.findOne(id);
    const nextRoleId = Object.prototype.hasOwnProperty.call(updateUserDto, 'roleId')
      ? updateUserDto.roleId
      : old.roleId;
    await this.privilegeGrantGuard.assertCanAssignRole(
      actorId,
      nextRoleId,
      { kind: 'global-user' },
      old.roleId ?? null,
      `user ${id}`
    );
    const updated = applyDtoUpdates(old, updateUserDto, [
      'username',
      'roleId',
      'isActive',
      'givenName',
      'familyName',
      'description',
      'modifiedById',
    ]);
    return this.usersRepository.save(updated);
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.usersRepository.remove(old);
    return undefined;
  }
}
