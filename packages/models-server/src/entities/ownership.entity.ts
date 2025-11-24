import {
  IEdorg,
  IOds,
  IOwnership,
  IRole,
  IEdfiTenant,
  ITeam,
  ISbEnvironment,
  IIntegrationProvider,
} from '@edanalytics/models';
import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
@Unique(['teamId', 'sbEnvironmentId'])
@Unique(['teamId', 'edfiTenantId'])
@Unique(['teamId', 'odsId'])
@Unique(['teamId', 'edorgId'])
@Unique(['teamId', 'integrationProviderId'])
export class Ownership extends EntityBase implements IOwnership {
  @ManyToOne('Team', (team: ITeam) => team.ownerships, { onDelete: 'CASCADE' })
  team: ITeam;
  @Column()
  teamId: ITeam['id'];

  @ManyToOne('Role', { nullable: true, onDelete: 'SET NULL' })
  role: IRole | null;

  @Column({ nullable: true })
  roleId: IRole['id'] | null;

  @ManyToOne('SbEnvironment', (sbEnvironment: ISbEnvironment) => sbEnvironment.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  sbEnvironment?: ISbEnvironment;
  @Column({ nullable: true })
  sbEnvironmentId?: number;

  @ManyToOne('EdfiTenant', (edfiTenant: IEdfiTenant) => edfiTenant.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  edfiTenant?: IEdfiTenant;
  @Column({ nullable: true })
  edfiTenantId?: number;

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

  @ManyToOne('IntegrationProvider', (provider: IIntegrationProvider) => provider.ownerships, {
    eager: true,
    onDelete: 'CASCADE',
  })
  integrationProvider?: IIntegrationProvider;
  @Column({ nullable: true })
  integrationProviderId?: number;
}
