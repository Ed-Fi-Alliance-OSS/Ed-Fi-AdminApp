import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostUserTenantMembershipDto,
  PutUserTenantMembershipDto,
} from '@edanalytics/models';
import { Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { UserTenantMembership } from '@edanalytics/models-server';

@Injectable()
export class UserTenantMembershipsService {
  constructor(
    @InjectRepository(UserTenantMembership)
    private userTenantMembershipsRepository: Repository<UserTenantMembership>
  ) {}

  create(createUserTenantMembershipDto: PostUserTenantMembershipDto) {
    return this.userTenantMembershipsRepository.save(
      this.userTenantMembershipsRepository.create(createUserTenantMembershipDto)
    );
  }

  findAll(tenantId: number) {
    return this.userTenantMembershipsRepository.findBy({
      tenantId,
    });
  }

  findOne(tenantId: number, id: number) {
    return this.userTenantMembershipsRepository
      .findOneByOrFail({ tenantId, id })
      .catch(throwNotFound);
  }

  async update(
    tenantId: number,
    id: number,
    updateUserTenantMembershipDto: PutUserTenantMembershipDto
  ) {
    const old = await this.findOne(tenantId, id);
    return this.userTenantMembershipsRepository.save({
      ...old,
      ...updateUserTenantMembershipDto,
    });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.userTenantMembershipsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
