import { GetUserDto, PostOwnershipDto, PutOwnershipDto } from '@edanalytics/models';
import { Ownership } from '@edanalytics/models-server';
import { formErrFromValidator } from '@edanalytics/utils';
import { Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { ValidationError } from 'class-validator';
import { EntityManager, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { throwNotFound } from '../utils';
import { ValidationException } from '../utils/customExceptions';

@Injectable()
export class OwnershipsGlobalService {
  constructor(
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,

    @Inject(AuthService) private readonly authService: AuthService
  ) {}
  async create(createOwnershipDto: PostOwnershipDto) {
    const isRedundant = !!(
      await this.ownershipsRepository.findBy({
        tenantId: createOwnershipDto.tenantId,
        edorgId: createOwnershipDto.edorgId,
        odsId: createOwnershipDto.odsId,
        sbeId: createOwnershipDto.sbeId,
      })
    ).length;

    if (isRedundant) {
      const err = new ValidationError();
      err.property = 'tenantId';
      err.constraints = {
        server:
          'An ownership already exists for this tenant\u2013resource combination. To minimize confusion we disallow duplication.',
      };
      err.value = false;
      throw new ValidationException(formErrFromValidator([err]));
    }

    const out = await this.ownershipsRepository.save(
      this.ownershipsRepository.create(createOwnershipDto)
    );
    this.authService.reloadTenantOwnershipCache(createOwnershipDto.tenantId);
    return out;
  }

  async findOne(id: number) {
    return this.ownershipsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateOwnershipDto: PutOwnershipDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    const out = await this.ownershipsRepository.save({ ...old, ...updateOwnershipDto });
    this.authService.reloadTenantOwnershipCache(old.tenantId);
    return out;
  }

  async remove(id: number, user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.ownershipsRepository.remove(old);
    this.authService.reloadTenantOwnershipCache(old.tenantId);
    return undefined;
  }
}
