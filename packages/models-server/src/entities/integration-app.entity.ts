import { Column, Entity, ManyToOne, ViewColumn, ViewEntity } from 'typeorm';
import {
  IEdfiTenant,
  IIntegrationApp,
  IIntegrationAppDetailed,
  IIntegrationProvider,
  IOds,
  ISbEnvironment,
} from '@edanalytics/models';
import { EdfiTenant } from './edfi-tenant.entity';
import { IntegrationProvider } from './integration-provider.entity';
import { Ods } from './ods.entity';
import { SbEnvironment } from './sb-environment.entity';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class IntegrationApp extends EntityBase implements IIntegrationApp {
  @Column()
  applicationId: number | null;

  @Column()
  applicationName: string;

  @ManyToOne('EdfiTenant', (edfiTenant: IEdfiTenant) => edfiTenant.integrationApps, {
    eager: true,
    onDelete: 'CASCADE',
  })
  edfiTenant: EdfiTenant;
  @Column()
  edfiTenantId: number;

  @Column({ type: 'simple-array', default: '' })
  edorgIds: number[];

  @ManyToOne('IntegrationProvider', (provider: IIntegrationProvider) => provider.integrationApps, {
    eager: true,
    onDelete: 'CASCADE',
  })
  integrationProvider: IntegrationProvider;
  @Column()
  integrationProviderId: number;

  @ManyToOne('Ods', (ods: IOds) => ods.integrationApps, {
    eager: true,
    onDelete: 'CASCADE',
  })
  ods: Ods;

  @Column()
  odsId: number;

  @ManyToOne('SbEnvironment', (sbEnvironment: ISbEnvironment) => sbEnvironment.integrationApps, {
    eager: true,
    onDelete: 'CASCADE',
  })
  sbEnvironment: SbEnvironment;
  @Column()
  sbEnvironmentId: number;
}

@ViewEntity({
  name: 'integration_apps_view',
})
export class IntegrationAppDetailed
  extends EntityBase
  implements
    Omit<IIntegrationAppDetailed, 'edfiTenant' | 'integrationProvider' | 'ods' | 'sbEnvironment'>
{
  @ViewColumn()
  applicationId: number | null;

  @ViewColumn()
  applicationName: string;

  @ViewColumn()
  edfiTenantId: number;

  @ViewColumn()
  edfiTenantName: string;

  @ViewColumn()
  edorgIds: number[];

  @ViewColumn()
  edorgNames: string[];

  @ViewColumn()
  integrationProviderId: number;

  @ViewColumn()
  integrationProviderName: string;

  @ViewColumn()
  odsId: number;

  @ViewColumn()
  odsName: string;

  @ViewColumn()
  sbEnvironmentId: number;

  @ViewColumn()
  sbEnvironmentName: string;
}
