import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostTenantDto,
  PutTenantDto,
  Tenant,
} from '@edanalytics/models';
import { Repository } from 'typeorm';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantsRepository: Repository<Tenant>
  ) {}

  create(createTenantDto: PostTenantDto) {
    return this.tenantsRepository.save(
      this.tenantsRepository.create(createTenantDto)
    );
  }

  findAll() {
    return this.tenantsRepository.find();
  }

  findOne(id: number) {
    return this.tenantsRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Tenant not found');
    });
  }

  async update(id: number, updateTenantDto: PutTenantDto) {
    await this.tenantsRepository.update(id, updateTenantDto);
    return this.tenantsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Tenant not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.tenantsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Tenant not found');
    });
    await this.tenantsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
