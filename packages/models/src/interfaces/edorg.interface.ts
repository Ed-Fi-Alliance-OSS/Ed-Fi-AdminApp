import { IOwnership } from '.';
import { EdorgType } from '../enums/edorg-type.enum';
import { IEntityBase } from '../utils/entity-base.interface';
import { IOds } from './ods.interface';
import { IEdfiTenant } from './edfi-tenant.interface';

export interface IEdorg extends IEntityBase {
  ownerships: IOwnership[];

  edfiTenant: IEdfiTenant;
  edfiTenantId: number;

  sbEnvironmentId: number;

  ods: IOds;
  odsId: number;
  odsDbName: string;
  odsInstanceId: number | null;

  children: IEdorg[];
  parent?: IEdorg;
  parentId?: number;

  educationOrganizationId: number;
  nameOfInstitution: string;
  shortNameOfInstitution: string;
  discriminator: EdorgType;
}
