import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetUserDto,
  PostEdorgDto,
  PutEdorgDto,
  Edorg,
} from '@edanalytics/models';
import { Repository } from 'typeorm';

@Injectable()
export class EdorgsService {
  constructor(
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>
  ) { }

  create(createEdorgDto: PostEdorgDto) {
    return this.edorgsRepository.save(
      this.edorgsRepository.create(createEdorgDto)
    );
  }

  findAll(sbeId: number) {
    return this.edorgsRepository.find({
      where: {
        sbeId
      }
    });
  }

  findOne(id: number) {
    return this.edorgsRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Edorg not found');
    });
  }

  async update(id: number, updateEdorgDto: PutEdorgDto) {
    await this.edorgsRepository.update(id, updateEdorgDto);
    return this.edorgsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Edorg not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.edorgsRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Edorg not found');
    });
    await this.edorgsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
