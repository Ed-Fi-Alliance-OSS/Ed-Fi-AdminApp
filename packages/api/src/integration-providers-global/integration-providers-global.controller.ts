import {
  PutIntegrationProviderDto,
  PostIntegrationProviderDto,
  toGetIntegrationProviderDto,
} from '@edanalytics/models';
import { IntegrationProvider, Ownership } from '@edanalytics/models-server';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ValidationHttpException, throwNotFound } from '../utils';
import { Authorize } from '../auth/authorization';

@ApiTags('IntegrationProvider - Global')
@Controller()
export class IntegrationProvidersGlobalController {
  constructor(
    @InjectRepository(IntegrationProvider)
    private integrationProvidersRepository: Repository<IntegrationProvider>,
    @InjectRepository(Ownership)
    private ownershipsViewRepository: Repository<Ownership>
  ) {}

  @Post()
  @Authorize({
    privilege: 'integration-provider:create',
    subject: { id: '__filtered__' },
  })
  async create(@Body() createIntegrationProviderDto: PostIntegrationProviderDto) {
    try {
      return toGetIntegrationProviderDto(
        await this.integrationProvidersRepository.save(
          this.integrationProvidersRepository.create(createIntegrationProviderDto)
        )
      );
    } catch (error) {
      console.log('error', error);
      if (error?.code === '23505') {
        throw new ValidationHttpException({
          field: 'name',
          message: 'Integration provider with that name already exists',
        });
      }
      throw error;
    }
  }

  async findOne(id: number) {
    return await this.integrationProvidersRepository.findOneByOrFail({ id }).catch(throwNotFound);
  }

  @Get()
  @Authorize({
    privilege: 'integration-provider:read',
    subject: { id: '__filtered__' },
  })
  async find(@Query('id') id?: number, @Query('teamId') teamId?: number) {
    if (id) {
      return toGetIntegrationProviderDto(await this.findOne(id));
    }

    if (teamId) {
      const ownerships = await this.ownershipsViewRepository.find({
        where: { teamId, integrationProviderId: Not(IsNull()) },
      });
      const providerIds = ownerships.map((ownership) => ownership.integrationProviderId);
      return toGetIntegrationProviderDto(
        await this.integrationProvidersRepository.find({ where: { id: In(providerIds) } })
      );
    }

    return toGetIntegrationProviderDto(
      await this.integrationProvidersRepository.find().catch(throwNotFound)
    );
  }

  @Put(':id')
  @Authorize({
    privilege: 'integration-provider:update',
    subject: { id: '__filtered__' },
  })
  async update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() updateIntegrationProviderDto: PutIntegrationProviderDto
  ) {
    const old = await this.findOne(id);
    return toGetIntegrationProviderDto(
      await this.integrationProvidersRepository.save({
        ...old,
        ...updateIntegrationProviderDto,
      })
    );
  }

  @Delete(':id')
  @Authorize({
    privilege: 'integration-provider:delete',
    subject: { id: '__filtered__' },
  })
  async remove(@Param('id', new ParseIntPipe()) id: number) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.integrationProvidersRepository.remove(old);
    return undefined;
  }
}
