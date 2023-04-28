import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostOdsDto, PutOdsDto, Ods } from '@edanalytics/models';
import { Repository } from 'typeorm';

@Injectable()
export class OdssService {
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>
  ) { }

  create(createOdsDto: PostOdsDto) {
    return this.odssRepository.save(this.odssRepository.create(createOdsDto));
  }

  findAll(sbeId: number) {
    return this.odssRepository.find({
      where: {
        sbeId
      }
    });
  }

  findOne(id: number) {
    return this.odssRepository.findOneByOrFail({ id: id }).catch((err) => {
      throw new NotFoundException('Ods not found');
    });
  }

  async update(id: number, updateOdsDto: PutOdsDto) {
    await this.odssRepository.update(id, updateOdsDto);
    return this.odssRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Ods not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.odssRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Ods not found');
    });
    await this.odssRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
