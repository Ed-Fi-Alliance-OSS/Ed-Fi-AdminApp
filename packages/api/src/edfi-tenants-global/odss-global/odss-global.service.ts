import { Ods } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../../utils';

@Injectable()
export class OdssGlobalService {
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>
  ) {}

  findAll(edfiTenantId: number) {
    return this.odssRepository.findBy({
      edfiTenantId,
    });
  }

  findOne(edfiTenantId: number, id: number) {
    return this.odssRepository
      .findOneByOrFail({
        edfiTenantId,
        id,
      })
      .catch(throwNotFound);
  }
}
