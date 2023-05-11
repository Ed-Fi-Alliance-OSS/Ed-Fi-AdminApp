import { IOwnership, IResource, IRole, ITenant } from '@edanalytics/models';
import { Column, Entity, ManyToOne } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Entity()
export class Ownership extends EntityBase implements IOwnership {
  @ManyToOne('Tenant', (tenant: ITenant) => tenant.ownerships)
  tenant: ITenant;
  @Column()
  tenantId: ITenant['id'];

  @ManyToOne('Role', { nullable: true })
  role: IRole;
  @Column({ nullable: true })
  roleId: IRole['id'];

  @ManyToOne('Resource', (resource: IResource) => resource.ownerships, {
    eager: true,
  })
  resource: IResource;
  @Column({ nullable: true })
  resourceId: number;
}
