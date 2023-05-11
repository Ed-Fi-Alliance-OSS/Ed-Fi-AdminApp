import { GetUserDto, PostOdsDto, PutOdsDto } from '@edanalytics/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { SbesService } from '../sbes/sbes.service';
import { Ods, Ownership } from '@edanalytics/models-server';

@Injectable()
export class OdssService {
  constructor(
    @InjectRepository(Ods)
    private odssRepository: Repository<Ods>,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>,
    private readonly sbesService: SbesService
  ) {}

  async getTenantOwnedOdsIds(tenantId: number) {
    return (
      await this.odssRepository
        .createQueryBuilder('ods')
        .innerJoin('ods.resource', 'rsc')
        .innerJoin('rsc.ownerships', 'owns')
        .where('owns.tenantId = :tenantId', { tenantId })
        .select('ods.id', 'odsId')
        .execute()
    ).map((result) => result.odsId) as number[];
  }

  async getTenantOdss(tenantId: number) {
    const ownedSbeIds = await this.sbesService.getTenantOwnedSbeIds(tenantId);
    const odsIds = (
      await this.ownershipsRepository.find({
        where: { tenantId },
        relations: ['resource', 'resource.ods', 'resource.edorg'],
      })
    )
      .map((o) =>
        o.resource?.edorg ? o.resource?.edorg?.odsId : o.resource?.ods?.id
      )
      .filter((value) => value !== undefined);

    return this.odssRepository.findBy([
      {
        sbeId: In(ownedSbeIds),
      },
      {
        id: In(odsIds),
      },
    ]);
  }

  create(createOdsDto: PostOdsDto) {
    return this.odssRepository.save(this.odssRepository.create(createOdsDto));
  }

  async findAll(tenantId: number) {
    return this.getTenantOdss(tenantId);
  }

  findOne(tenantId: number, id: number) {
    return this.odssRepository
      .createQueryBuilder('ods')
      .innerJoin('ods.<property>', '<alias>')
      .where('<alias>.tenantId = :tenantId', { tenantId })
      .andWhere('ods.id = :id', { id })
      .getOneOrFail()
      .catch(throwNotFound);
  }

  async update(tenantId: number, id: number, updateOdsDto: PutOdsDto) {
    const old = await this.findOne(tenantId, id);
    return this.odssRepository.save({ ...old, ...updateOdsDto });
  }

  async remove(tenantId: number, id: number, user: GetUserDto) {
    const old = await this.findOne(tenantId, id);
    await this.odssRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
