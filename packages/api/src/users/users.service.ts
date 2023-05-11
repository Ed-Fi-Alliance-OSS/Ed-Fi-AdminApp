import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostUserDto, PutUserDto } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { User } from '@edanalytics/models-server';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  create(createUserDto: PostUserDto) {
    return this.usersRepository.save(
      this.usersRepository.create(createUserDto)
    );
  }

  findAll(tenantId: number) {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.userTenantMemberships', 'utm')
      .where('utm.tenantId = :tenantId', { tenantId })
      .getMany();
  }

  findOne(tenantId: number, id: number) {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.userTenantMemberships', 'utm')
      .where('utm.tenantId = :tenantId', { tenantId })
      .andWhere('user.id = :id', { id })
      .getOneOrFail()
      .catch(throwNotFound);
  }

  async update(tenantId: number, id: number, updateUserDto: PutUserDto) {
    const old = await this.findOne(tenantId, id);
    return this.usersRepository.save({ ...old, ...updateUserDto });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.usersRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
