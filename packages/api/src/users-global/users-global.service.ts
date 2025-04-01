import { GetUserDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { User } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { throwNotFound } from '../utils';

@Injectable()
export class UsersGlobalService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) {}
  create(createUserDto: PostUserDto) {
    return this.usersRepository.save(this.usersRepository.create(createUserDto));
  }

  async findOne(id: number) {
    return this.usersRepository.findOneByOrFail({ id });
  }

  async findByUsername(username: string) {
    return this.usersRepository.findOneByOrFail({ username });
  }

  async update(id: number, updateUserDto: PutUserDto) {
    const old = await this.findOne(id);
    return this.usersRepository.save({ ...old, ...updateUserDto });
  }

  async remove(id: number, user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.usersRepository.remove(old);
    return undefined;
  }
}
