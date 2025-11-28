import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../../utils';
import { User } from '@edanalytics/models-server';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  findAll(teamId: number) {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.userTeamMemberships', 'utm')
      .where('utm.teamId = :teamId', { teamId })
      .getMany();
  }

  findOne(teamId: number, id: number) {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.userTeamMemberships', 'utm')
      .where('utm.teamId = :teamId', { teamId })
      .andWhere('user.id = :id', { id })
      .getOneOrFail()
      .catch(throwNotFound);
  }
}
