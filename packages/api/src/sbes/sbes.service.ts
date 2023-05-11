import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostSbeDto, PutSbeDto } from '@edanalytics/models';
import { In, Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import _ from 'lodash';
import { Sbe, Ownership } from '@edanalytics/models-server';

@Injectable()
export class SbesService {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}
  async getTenantOwnedSbeIds(tenantId: number) {
    return (
      await this.sbesRepository
        .createQueryBuilder('sbe')
        .innerJoin('sbe.resource', 'rsc')
        .innerJoin('rsc.ownerships', 'owns')
        .where('owns.tenantId = :tenantId', { tenantId })
        .select('sbe.id', 'sbeId')
        .execute()
    ).map((result) => result.sbeId) as number[];
  }
  async getTenantSbeIds(tenantId: number) {
    return (
      await this.ownershipsRepository.find({
        where: { tenantId },
        relations: [
          'resource',
          'resource.ods',
          'resource.sbe',
          'resource.edorg',
        ],
      })
    ).map(
      (o) =>
        o.resource?.edorg?.sbeId ??
        o.resource?.ods?.sbeId ??
        o.resource?.sbe?.id ??
        0
    );
  }

  create(createSbeDto: PostSbeDto) {
    return this.sbesRepository.save(this.sbesRepository.create(createSbeDto));
  }

  async findAll(tenantId: number) {
    const sbeIds = await this.getTenantSbeIds(tenantId);

    return this.sbesRepository.findBy({
      id: In(sbeIds),
    });
  }

  async findOne(tenantId: number, id: number) {
    const sbeIds = await this.getTenantSbeIds(tenantId);

    return this.sbesRepository
      .findOneByOrFail({
        id: In(_.intersection(sbeIds, [id])),
      })
      .catch(throwNotFound);
  }

  async update(tenantId: number, id: number, updateSbeDto: PutSbeDto) {
    const old = await this.findOne(tenantId, id);
    return this.sbesRepository.save({ ...old, ...updateSbeDto });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.sbesRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
