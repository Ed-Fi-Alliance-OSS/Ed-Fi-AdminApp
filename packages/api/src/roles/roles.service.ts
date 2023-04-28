import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostRoleDto, PutRoleDto, Role } from '@edanalytics/models';
import { Repository } from 'typeorm';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>
  ) {}

  create(createRoleDto: PostRoleDto) {
    return this.rolesRepository.save(
      this.rolesRepository.create(createRoleDto)
    );
  }

  findAll() {
    return this.rolesRepository.find();
  }

  findOne(id: number) {
    return this.rolesRepository.findOneByOrFail({ id: id }).catch(() => {
      throw new NotFoundException('Role not found');
    });
  }

  async update(id: number, updateRoleDto: PutRoleDto) {
    await this.rolesRepository.update(id, updateRoleDto);
    return this.rolesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Role not found');
    });
  }

  async remove(id: number, user: GetUserDto) {
    await this.rolesRepository.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException('Role not found');
    });
    await this.rolesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
