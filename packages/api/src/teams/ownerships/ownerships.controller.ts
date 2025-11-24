import { toGetOwnershipDto } from '@edanalytics/models';
import { Ownership } from '@edanalytics/models-server';
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Authorize } from '../../auth/authorization';
import { throwNotFound } from '../../utils';

@ApiTags('Ownership')
@Controller()
export class OwnershipsController {
  constructor(
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}

  @Get()
  @Authorize({
    privilege: 'team.ownership:read',
    subject: {
      id: '__filtered__',
      teamId: 'teamId',
    },
  })
  async findAll(@Param('teamId', new ParseIntPipe()) teamId: number) {
    return toGetOwnershipDto(await this.ownershipsRepository.findBy({ teamId }));
  }

  @Get(':ownershipId')
  @Authorize({
    privilege: 'team.ownership:read',
    subject: {
      id: 'ownershipId',
      teamId: 'teamId',
    },
  })
  async findOne(
    @Param('ownershipId', new ParseIntPipe()) ownershipId: number,
    @Param('teamId', new ParseIntPipe()) teamId: number
  ) {
    return toGetOwnershipDto(
      await this.ownershipsRepository
        .findOneByOrFail({ teamId, id: ownershipId })
        .catch(throwNotFound)
    );
  }
}
