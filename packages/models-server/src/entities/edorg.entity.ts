import { EdorgType, IEdorg, IOds, IOwnership, IEdfiTenant } from '@edanalytics/models';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  Tree,
  TreeChildren,
  TreeParent,
  Unique,
} from 'typeorm';
import { EntityBase } from '../utils/entity-base';

/**
 * The Edorg entity represents an education organization, such as a school, district, or service center.
 *
 * ### Composite key problem
 *
 * SBAA uses a meaningless auto-increment as the primary key, even though business logic with Admin API
 * or other external systems generally uses a composite natural key. This inconsistency is not wonderful,
 * but aside from any unintended bugs should not actually cause problems. The problems with the natural
 * key are: a) it's not the same between versions so using it wouldn't really eliminate the
 * inconsistency, and b) it's only unique within an EdFi Tenant, so we'd need to concatenate it with
 * two more identifiers as well, and it would get prohibitively long. ODSs and EdFi Tenants face the
 * same problem, and what we'd end up with is all three entities having largely-redundant keys.
 *
 * Overall the situation is the same one faced by any independent system that integrates with other
 * external ones and for which the external natural keys aren't quite sufficient.
 */
@Entity()
@Tree('closure-table')
@Unique(['edfiTenantId', 'odsId', 'educationOrganizationId'])
export class Edorg extends EntityBase implements IEdorg {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.edorg)
  ownerships: IOwnership[];

  @ManyToOne('Ods', (ods: IOds) => ods.edorgs, { onDelete: 'CASCADE' })
  ods: IOds;

  @Column()
  odsId: number;

  @Column()
  odsDbName: string;

  @Column({ nullable: true })
  odsInstanceId: number | null;

  @ManyToOne('EdfiTenant', (edfiTenant: IEdfiTenant) => edfiTenant.edorgs, { onDelete: 'CASCADE' })
  edfiTenant: IEdfiTenant;

  @Column()
  edfiTenantId: number;

  @Column()
  sbEnvironmentId: number;

  @TreeChildren()
  children: IEdorg[];

  @TreeParent()
  parent?: IEdorg;

  @Column({ nullable: true })
  parentId?: number | undefined;

  // TODO: bigint can handle bigger numbers than JS number & will eventually need to accomodate bigger numbers for edOrgIds
  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => {
        if (value > Number.MAX_SAFE_INTEGER) {
          throw new Error('Too-big educationOrganizationId encountered from sync');
        }
        return value;
      },
      from: (value: string) => {
        if (Number(value) > Number.MAX_SAFE_INTEGER) {
          throw new Error('Too-big educationOrganizationId encountered from sync');
        }
        // TypeORM is smart and unmarshals SQL bigint as a JS string for safety
        return Number(value);
      },
    },
    comment:
      'Pre-v7/v2, this reliably included the Ods name. In v7/v2 it is no longer alone sufficient as a natural key, and must be combined with an ODS identifier.',
  })
  educationOrganizationId: number;

  @Column()
  nameOfInstitution: string;

  @Column({ nullable: true })
  shortNameOfInstitution: string | null;

  @Column({ type: 'varchar' })
  discriminator: EdorgType;

  get displayName() {
    return this.nameOfInstitution;
  }
}
