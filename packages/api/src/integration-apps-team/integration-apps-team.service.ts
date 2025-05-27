import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { PostIntegrationAppDto, toGetIntegrationAppDto } from '@edanalytics/models';
import { IntegrationApp, IntegrationAppDetailed } from '@edanalytics/models-server';

import { Repository } from 'typeorm';

import { throwNotFound } from '../utils';

type FindAllProps = {
  edfiTenantId?: number;
  integrationProviderId?: number;
};

@Injectable()
export class IntegrationAppsTeamService {
  constructor(
    @InjectRepository(IntegrationApp)
    private integrationAppsRepository: Repository<IntegrationApp>,
    @InjectRepository(IntegrationAppDetailed)
    private integrationAppsDetailedRepository: Repository<IntegrationAppDetailed>
  ) {}

  async findOne({ applicationId, edfiTenantId }: { applicationId: number; edfiTenantId: number }) {
    return toGetIntegrationAppDto(
      await this.integrationAppsDetailedRepository.findOneBy({ applicationId, edfiTenantId })
    );
  }

  async findAll({ integrationProviderId, edfiTenantId }: FindAllProps) {
    const where: FindAllProps = {};

    if (edfiTenantId) where.edfiTenantId = edfiTenantId;
    if (integrationProviderId) where.integrationProviderId = integrationProviderId;

    const query: { where?: FindAllProps } = {};
    if (Object.keys(where).length) query.where = where;

    return toGetIntegrationAppDto(await this.integrationAppsDetailedRepository.find(query));
  }

  async create(body: PostIntegrationAppDto) {
    return await this.integrationAppsRepository.save(this.integrationAppsRepository.create(body));
  }

  async update({
    edfiTenantId,
    applicationId,
    applicationName,
  }: {
    edfiTenantId: number;
    applicationId: number;
    applicationName: string;
  }) {
    if (typeof applicationName !== 'string') {
      throw new Error('Integration Application name must be a string.');
    }

    const old = await this.integrationAppsRepository.findOneBy({ edfiTenantId, applicationId });
    delete old.integrationProvider;
    return await this.integrationAppsRepository.save({
      ...old,
      applicationName,
    });
  }

  async remove({ applicationId, edfiTenantId }: { applicationId: number; edfiTenantId: number }) {
    const old = await this.integrationAppsRepository.findOneBy({ applicationId, edfiTenantId });
    if (!old) return undefined;
    await this.integrationAppsRepository.remove(old);
    return undefined;
  }
}
