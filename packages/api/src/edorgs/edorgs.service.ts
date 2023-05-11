import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { GetUserDto, PostEdorgDto, PutEdorgDto } from '@edanalytics/models';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { OdssService } from '../odss/odss.service';
import { SbesService } from '../sbes/sbes.service';
import _ from 'lodash';
import { Edorg, Ownership, Sbe } from '@edanalytics/models-server';

@Injectable()
export class EdorgsService {
  constructor(
    @InjectRepository(Edorg)
    private edorgsRepository: Repository<Edorg>,
    @InjectEntityManager()
    private em: EntityManager,
    private readonly sbesService: SbesService,
    private readonly odssService: OdssService,
    @InjectRepository(Ownership)
    private ownershipsRepository: Repository<Ownership>
  ) {}

  async getTenantOwnedEdorgIds(tenantId: number, sbeId: Sbe['id']) {
    return (
      await this.edorgsRepository
        .createQueryBuilder('edorg')
        .innerJoin('edorg.resource', 'rsc')
        .innerJoin('rsc.ownerships', 'owns')
        .where('owns.tenantId = :tenantId', { tenantId })
        .select('edorg.id', 'edorgId')
        .execute()
    ).map((result) => result.edorgId) as number[];
  }

  async getTenantOwnedEdorgs(tenantId: number, sbeId: Sbe['id']) {
    const tr = this.em.getTreeRepository(Edorg);
    const ownedIds = await this.getTenantOwnedEdorgIds(tenantId, sbeId);
    return _.uniqWith(
      (
        await Promise.all(
          ownedIds.map((id) => tr.findDescendants({ id } as Edorg))
        )
      ).flat()
    );
  }

  async getTenantEdorgs(tenantId: number, sbeId: Sbe['id']) {
    const sbeIds = await this.sbesService.getTenantOwnedSbeIds(tenantId);
    const odsIds = await this.odssService.getTenantOwnedOdsIds(tenantId);
    const ownedEdorgs = await this.getTenantOwnedEdorgs(tenantId, sbeId);
    const ownedEdorgIds = ownedEdorgs.map((e) => e.id);
    const inheritedEdorgs = await this.edorgsRepository.findBy([
      {
        id: Not(In(ownedEdorgIds)),
        odsId: In(odsIds),
      },
      {
        id: Not(In(ownedEdorgIds)),
        sbeId: In(sbeIds),
      },
    ]);

    return [...inheritedEdorgs, ...ownedEdorgs];
  }

  create(createEdorgDto: PostEdorgDto) {
    return this.edorgsRepository.save(
      this.edorgsRepository.create(createEdorgDto)
    );
  }

  findAll(tenantId: number, sbeId: Sbe['id']) {
    return this.getTenantEdorgs(tenantId, sbeId);
  }

  findOne(tenantId: number, sbeId: Sbe['id'], id: number) {
    return this.edorgsRepository
      .createQueryBuilder('edorg')
      .innerJoin('edorg.<property>', '<alias>')
      .where('<alias>.tenantId = :tenantId', { tenantId })
      .andWhere('edorg.id = :id', { id })
      .getOneOrFail()
      .catch(throwNotFound);
  }

  async update(
    tenantId: number,
    sbeId: Sbe['id'],
    id: number,
    updateEdorgDto: PutEdorgDto
  ) {
    const old = await this.findOne(tenantId, sbeId, id);
    return this.edorgsRepository.save({ ...old, ...updateEdorgDto });
  }

  async remove(
    tenantId: number,
    sbeId: Sbe['id'],
    id: number,
    user: GetUserDto
  ) {
    const old = await this.findOne(tenantId, sbeId, id);
    await this.edorgsRepository.update(id, {
      deleted: new Date(),
      deletedById: user.id,
    });
    return undefined;
  }
}
