import { IIntegrationApp, IIntegrationProvider, IOwnership } from '@edanalytics/models';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Index(['name'], { unique: true })
@Entity()
export class IntegrationProvider extends EntityBase implements IIntegrationProvider {
  @Column()
  name: string;

  @Column()
  description: string;

  @OneToMany('Ownership', (ownership: IOwnership) => ownership.integrationProvider)
  ownerships: IOwnership[];

  @OneToMany(
    'IntegrationApp',
    (integrationApp: IIntegrationApp) => integrationApp.integrationProvider
  )
  integrationApps: IIntegrationApp[];

  appCount?: number;
}
