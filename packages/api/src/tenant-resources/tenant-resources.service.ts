import { Edorg, Ods, Ownership, Role, Sbe, UserTenantMembership } from '@edanalytics/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

@Injectable()
export class TenantResourcesService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Ods)
    private odsRepository: Repository<Ods>,
    @InjectRepository(Edorg)
    private edorgRepository: Repository<Edorg>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(UserTenantMembership)
    private utmRepository: Repository<UserTenantMembership>,
    @InjectRepository(Ownership)
    private ownershipRepository: Repository<Ownership>,
  ) { }

  getSbes(tenantId: number) {
    return this.sbesRepository.find();
  }
  getOdss(tenantId: number, sbeId: number) {
    return this.odsRepository.find({
      where: {
        sbeId
      },
    });
  }
  getEdorgs(tenantId: number, sbeId: number) {
    return this.edorgRepository.find({
      where: { sbeId },
    });
  }
  getRoles(tenantId: number) {
    return this.roleRepository.find({
      where: [
        { tenantId: null },
        { tenantId },
      ],
    });
  }
  async getUsers(tenantId: number) {
    return (await this.utmRepository.find({
      where: {
        tenantId,
        role: Not(IsNull())
      },
      relations: ['user']
    })).map(utm => utm.user);
  }
  getUserTenantMemberships(tenantId: number) {
    return this.utmRepository.find({
      where: {
        tenantId
      },
      relations: [
        'role',
        'user'
      ]
    });
  }
  getOwnerships(tenantId: number) {
    return this.ownershipRepository.find();
  }
}
