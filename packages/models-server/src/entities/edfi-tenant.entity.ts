import {
  IEdfiTenant,
  IEdorg,
  IIntegrationApp,
  IOds,
  IOwnership,
  ISbEnvironment,
} from '@edanalytics/models';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class EdfiTenant extends EntityBase implements IEdfiTenant {
  @OneToMany('Ownership', (ownership: IOwnership) => ownership.edfiTenant)
  ownerships: IOwnership[];

  @ManyToOne('SbEnvironment', (sbEnvironment: ISbEnvironment) => sbEnvironment.edfiTenants, {
    onDelete: 'CASCADE',
  })
  sbEnvironment: ISbEnvironment;
  @Column()
  sbEnvironmentId: ISbEnvironment['id'];

  @OneToMany('Ods', (ods: IOds) => ods.edfiTenant)
  odss: IOds[];
  @OneToMany('Edorg', (edorg: IEdorg) => edorg.edfiTenant)
  edorgs: IEdorg[];

  @OneToMany('IntegrationApp', (integrationApp: IIntegrationApp) => integrationApp.edfiTenant)
  integrationApps: IIntegrationApp[];

  @Column({
    comment:
      'The name used in the tenant management database in StartingBlocks, or "default" for v5/6 environments',
  })
  name: string;

  get displayName() {
    return this.name;
  }
}
