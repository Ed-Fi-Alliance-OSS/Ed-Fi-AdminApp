import { IEdorg, IOds, IOwnership, IEdfiTenant, IIntegrationApp } from '@edanalytics/models';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ods extends EntityBase implements IOds {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.ods)
  ownerships: IOwnership[];

  @ManyToOne('EdfiTenant', (edfiTenant: IEdfiTenant) => edfiTenant.odss, { onDelete: 'CASCADE' })
  edfiTenant: IEdfiTenant;
  @Column()
  edfiTenantId: number;

  @Column()
  sbEnvironmentId: number;

  @OneToMany('Edorg', (edorg: IEdorg) => edorg.ods)
  edorgs: IEdorg[];

  @OneToMany(
    'IntegrationApp',
    (integrationApp: IIntegrationApp) => integrationApp.integrationProvider
  )
  integrationApps: IIntegrationApp[];

  @Column({ nullable: true })
  odsInstanceId: number | null;

  @Column({ nullable: true })
  odsInstanceName: string | null;

  @Column()
  dbName: string;

  get displayName() {
    return this.dbName;
  }
}
