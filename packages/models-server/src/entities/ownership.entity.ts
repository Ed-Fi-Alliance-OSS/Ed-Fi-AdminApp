import { IEdorg, IOds, IOwnership, IRole, ISbe, ITenant } from '@edanalytics/models';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
@Unique(['tenantId', 'sbeId'])
@Unique(['tenantId', 'odsId'])
@Unique(['tenantId', 'edorgId'])
export class Ownership extends EntityBase implements IOwnership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.ownerships, { onDelete: 'CASCADE' })
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id'];

  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role: IRole | null;

  @Column({ nullable: true })
  roleId: IRole['id'] | null;

  @ManyToOne('Sbe', (sbe: ISbe) => sbe.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  sbe?: ISbe;
  @Column({ nullable: true })
  sbeId?: number;

  @ManyToOne('Ods', (ods: IOds) => ods.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  ods?: IOds;
  @Column({ nullable: true })
  odsId?: number;

  @ManyToOne('Edorg', (edorg: IEdorg) => edorg.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  edorg?: IEdorg;
  @Column({ nullable: true })
  edorgId?: number;
}
