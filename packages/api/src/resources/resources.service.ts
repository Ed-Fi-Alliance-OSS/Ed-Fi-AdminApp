import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostResourceDto,
  PutResourceDto,
} from '@edanalytics/models';
import { Repository } from 'typeorm';
import { Resource } from '@edanalytics/models-server';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourcesRepository: Repository<Resource>
  ) {}

  create(createResourceDto: PostResourceDto) {
    return this.resourcesRepository.save(
      this.resourcesRepository.create(createResourceDto)
    );
  }

  findAll() {
    return this.resourcesRepository.find();
  }

  findOne(id: number) {
    return this.resourcesRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Resource not found');
    });
  }

  async update(id: number, updateResourceDto: PutResourceDto) {
    await this.resourcesRepository.update(id, updateResourceDto);
    return this.resourcesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Resource not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.resourcesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Resource not found');
    });
    await this.resourcesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
