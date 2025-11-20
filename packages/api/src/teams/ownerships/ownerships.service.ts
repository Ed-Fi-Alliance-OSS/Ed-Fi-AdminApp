import { Ownership } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OwnershipsService {
  constructor(
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}
}
