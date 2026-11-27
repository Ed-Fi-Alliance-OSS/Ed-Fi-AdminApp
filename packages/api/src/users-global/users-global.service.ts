import { GetUserDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { CertificationRun, CertificationRunComment, User } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { applyDtoUpdates, resolveNextRoleId, throwNotFound } from '../utils';
import { PrivilegeGrantGuardService } from '../auth/authorization/privilege-grant-guard.service';

@Injectable()
export class UsersGlobalService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly privilegeGrantGuard: PrivilegeGrantGuardService,
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
      }),
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
    const nextRoleId = resolveNextRoleId(updateUserDto, old.roleId);
    await this.privilegeGrantGuard.assertCanAssignRole(
      actorId,
      nextRoleId,
      { kind: 'global-user' },
      old.roleId ?? null,
      `user ${id}`,
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
    await this.entityManager.transaction(async (em) => {
      // certification_run.createdById and certification_run_comment.authorId are NO ACTION on
      // SQL Server (SET NULL on PostgreSQL), so clear them first or the delete fails for anyone
      // who started a certification run or wrote a review comment.
      await em.getRepository(CertificationRun).update({ createdById: id }, { createdById: null });
      await em.getRepository(CertificationRunComment).update({ authorId: id }, { authorId: null });
      await em.getRepository(User).remove(old);
    });
    return undefined;
  }
}
