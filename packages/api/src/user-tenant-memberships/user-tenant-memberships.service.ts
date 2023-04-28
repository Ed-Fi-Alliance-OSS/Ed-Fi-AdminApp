import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostUserTenantMembershipDto,
  PutUserTenantMembershipDto,
  UserTenantMembership,
} from '@edanalytics/models';
import { Repository } from 'typeorm';

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

  findAll() {
    return this.userTenantMembershipsRepository.find();
  }

  findOne(id: number) {
    return this.userTenantMembershipsRepository
      .findOneByOrFail({ id: id })
      .catch(() => {
        throw new NotFoundException('UserTenantMembership not found');
      });
  }

  async update(
    id: number,
    updateUserTenantMembershipDto: PutUserTenantMembershipDto
  ) {
    await this.userTenantMembershipsRepository.update(
      id,
      updateUserTenantMembershipDto
    );
    return this.userTenantMembershipsRepository
      .findOneByOrFail({ id })
      .catch(() => {
        throw new NotFoundException('UserTenantMembership not found');
      });
  }

  async remove(id: number, user: GetUserDto) {
    await this.userTenantMembershipsRepository
      .findOneByOrFail({ id })
      .catch(() => {
        throw new NotFoundException('UserTenantMembership not found');
      });
    await this.userTenantMembershipsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
