import { PostEdfiTenantDto } from '@edanalytics/models';
import { EdfiTenant } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminApiServiceV1 } from '../teams/edfi-tenants/starting-blocks/v1/admin-api.v1.service';
import { AdminApiServiceV2 } from '../teams/edfi-tenants/starting-blocks/v2/admin-api.v2.service';

@Injectable()
export class EdfiTenantsGlobalService {
  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    private readonly adminApiServiceV1: AdminApiServiceV1,
    private readonly adminApiServiceV2: AdminApiServiceV2
  ) {}
  create(createEdfiTenantDto: PostEdfiTenantDto) {
    return this.edfiTenantsRepository.save(this.edfiTenantsRepository.create(createEdfiTenantDto));
  }
}
