import { Edorg } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../../utils';

@Injectable()
export class EdorgsGlobalService {
  constructor(
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>
  ) {}

  findAll(edfiTenantId: number) {
    return this.edorgsRepository.findBy({
      edfiTenantId,
    });
  }

  findOne(edfiTenantId: number, id: number) {
    return this.edorgsRepository
      .findOneByOrFail({
        edfiTenantId,
        id,
      })
      .catch(throwNotFound);
  }
}
