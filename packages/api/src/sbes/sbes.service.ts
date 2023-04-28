import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostSbeDto, PutSbeDto, Sbe } from '@edanalytics/models';
import { Repository } from 'typeorm';

@Injectable()
export class SbesService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>
  ) {}

  create(createSbeDto: PostSbeDto) {
    return this.sbesRepository.save(this.sbesRepository.create(createSbeDto));
  }

  findAll() {
    return this.sbesRepository.find();
  }

  findOne(id: number) {
    return this.sbesRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Sbe not found');
    });
  }

  async update(id: number, updateSbeDto: PutSbeDto) {
    await this.sbesRepository.update(id, updateSbeDto);
    return this.sbesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Sbe not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.sbesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Sbe not found');
    });
    await this.sbesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
