import {
  GetUserDto,
  PostSbeDto,
  PutSbeAdminApi,
  PutSbeAdminApiRegister,
  PutSbeDto,
  PutSbeMeta,
} from '@edanalytics/models';
import { Sbe, regarding } from '@edanalytics/models-server';
import { StatusResponse } from '@edanalytics/utils';
import { Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CacheService } from '../app/cache.module';
import { AuthService } from '../auth/auth.service';
import {
  AdminApiService,
  StartingBlocksService,
} from '../tenants/sbes/starting-blocks/starting-blocks.service';
import { throwNotFound } from '../utils';
import { CustomHttpException } from '../utils/customExceptions';

@Injectable()
export class SbesGlobalService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    private readonly adminApiService: AdminApiService,
    private readonly sbService: StartingBlocksService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,

    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CacheService) private cacheManager: CacheService
  ) {}
  create(createSbeDto: PostSbeDto) {
    return this.sbesRepository.save(this.sbesRepository.create(createSbeDto));
  }

  async findOne(id: number) {
    return this.sbesRepository.findOneByOrFail({ id });
  }

  async updateAdminApi(id: number, updateDto: PutSbeAdminApi) {
    const old = await this.findOne(id);
    return this.sbesRepository.save({
      ...old,
      modifiedById: updateDto.modifiedById,
      configPublic: {
        ...old.configPublic,
        adminApiKey: updateDto.adminKey,
        adminApiUrl: updateDto.adminUrl,
      },
      configPrivate: {
        ...old.configPrivate,
        adminApiSecret: updateDto.adminSecret,
      },
    });
  }

  async updateSbMeta(id: number, updateDto: PutSbeMeta) {
    const old = await this.findOne(id);
    return this.sbesRepository.save({
      ...old,
      modifiedById: updateDto.modifiedById,
      configPublic: {
        ...old.configPublic,
        sbeMetaKey: updateDto.metaKey,
        sbeMetaArn: updateDto.arn,
      },
      configPrivate: {
        ...old.configPrivate,
        sbeMetaSecret: updateDto.metaSecret,
      },
    });
  }

  async selfRegisterAdminApi(sbe: Sbe, updateDto: PutSbeAdminApiRegister) {
    const registrationResult = await this.adminApiService.selfRegisterAdminApi(
      updateDto.adminRegisterUrl
    );

    if (registrationResult.status === 'SUCCESS') {
      const { credentials } = registrationResult;
      return {
        status: registrationResult.status,
        result: await this.sbesRepository.save({
          ...sbe,
          modifiedById: updateDto.modifiedById,
          configPublic: {
            ...sbe.configPublic,
            adminApiKey: credentials.ClientId,
            adminApiUrl: updateDto.adminRegisterUrl,
            adminApiClientDisplayName: credentials.DisplayName,
          },
          configPrivate: {
            ...sbe.configPrivate,
            adminApiSecret: credentials.ClientSecret,
          },
        }),
      };
    } else {
      return registrationResult;
    }
  }

  async remove(id: number, user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.sbesRepository.remove(old);
    return undefined;
  }

  async checkSbMeta(sbeId: number): Promise<StatusResponse> {
    const sbe = await this.findOne(sbeId).catch(throwNotFound);
    const sbMetaResult = await this.sbService.getSbMeta(sbe);
    const sbMeta = sbMetaResult.status === 'SUCCESS';

    await this.sbesRepository.save({
      ...sbe,
      configPublic: {
        ...sbe.configPublic,
        ...(sbMeta
          ? {
              lastSuccessfulConnectionSbMeta: new Date(),
            }
          : {
              lastFailedConnectionSbMeta: new Date(),
            }),
      },
    });

    if (sbMeta) {
      return {
        title: 'SB Metadata connection successful.',
        type: 'Success',
        regarding: regarding(sbe),
      };
    }

    const sbMetaMsg =
      sbMetaResult.status === 'INVALID_ARN'
        ? 'Invalid ARN provided for metadata function.'
        : sbMetaResult.error
        ? sbMetaResult.error
        : undefined;

    throw new CustomHttpException(
      {
        title: 'SB Metadata connection unsuccessful.',
        type: 'Error',
        message: sbMetaMsg,
        regarding: regarding(sbe),
      },
      500
    );
  }

  async checkAdminAPI(sbeId: number): Promise<StatusResponse> {
    const sbe = await this.findOne(sbeId).catch(throwNotFound);
    const loginResult = await this.adminApiService.logIntoAdminApi(sbe);
    const adminApi = loginResult.status === 'SUCCESS';

    await this.sbesRepository.save({
      ...sbe,
      configPublic: {
        ...sbe.configPublic,
        ...(adminApi
          ? {
              lastSuccessfulConnectionAdminApi: new Date(),
            }
          : {
              lastFailedConnectionAdminApi: new Date(),
            }),
      },
    });

    if (adminApi) {
      return {
        title: 'Admin API connection successful.',
        type: 'Success',
        regarding: regarding(sbe),
      };
    }

    const adminApiMsg =
      loginResult.status === 'INVALID_ADMIN_API_URL'
        ? 'Invalid URL.'
        : loginResult.status === 'NO_ADMIN_API_URL'
        ? 'No URL provided.'
        : loginResult.status === 'LOGIN_FAILED'
        ? 'Unknown failure.'
        : undefined;

    throw new CustomHttpException(
      {
        title: 'Admin API connection unsuccessful.',
        type: 'Error',
        message: adminApiMsg,
        regarding: regarding(sbe),
      },
      500
    );
  }
  async update(id: number, updateSbeDto: PutSbeDto) {
    const old = await this.findOne(id);
    return this.sbesRepository.save({ ...old, ...updateSbeDto });
  }
}
