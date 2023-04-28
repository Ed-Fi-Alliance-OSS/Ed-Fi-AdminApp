import {
  Privilege
} from '@edanalytics/models';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PrivilegesService {
  constructor(
    @InjectRepository(Privilege)
    private privilegesRepository: Repository<Privilege>
  ) { }

  findAll() {
    return this.privilegesRepository.find();
  }

  findOne(code: string) {
    return this.privilegesRepository.findOneByOrFail({ code }).catch(() => {
      throw new NotFoundException('Privilege not found');
    });
  }
}
