import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostOwnershipDto,
  PutOwnershipDto,
  Ownership,
} from '@edanalytics/models';
import { Repository } from 'typeorm';

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

  findAll() {
    return this.ownershipsRepository.find();
  }

  findOne(id: number) {
    return this.ownershipsRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Ownership not found');
    });
  }

  async update(id: number, updateOwnershipDto: PutOwnershipDto) {
    await this.ownershipsRepository.update(id, updateOwnershipDto);
    return this.ownershipsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Ownership not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.ownershipsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Ownership not found');
    });
    await this.ownershipsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
