import {
  GetUserDto,
  PostOwnershipDto,
  PutOwnershipDto,
} from '@edanalytics/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { Ownership } from '@edanalytics/models-server';

@Injectable()
export class OwnershipsService {
  constructor(
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}

  create(createOwnershipDto: PostOwnershipDto) {
    return this.ownershipsRepository.save(
      this.ownershipsRepository.create(createOwnershipDto)
    );
  }

  findAll(tenantId: number) {
    return this.ownershipsRepository.findBy({
      tenantId,
    });
  }

  findOne(tenantId: number, id: number) {
    return this.ownershipsRepository
      .findOneByOrFail({ tenantId, id })
      .catch(throwNotFound);
  }

  async update(
    tenantId: number,
    id: number,
    updateOwnershipDto: PutOwnershipDto
  ) {
    const old = await this.findOne(tenantId, id);
    return this.ownershipsRepository.save({ ...old, ...updateOwnershipDto });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.ownershipsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
