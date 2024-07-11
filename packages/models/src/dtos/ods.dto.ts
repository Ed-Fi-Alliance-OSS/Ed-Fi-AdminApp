import { Expose } from 'class-transformer';
import { IOds } from '../interfaces/ods.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';
import { MinLength, MaxLength, Matches } from 'class-validator';
import { TrimWhitespace } from '../utils';

// This is a Get DTO that should not have whitespace trimmed
export class OdsTemplateOptionDto {
  @Expose()
  id: string;
  @Expose()
  displayName: string;
}
export const toOdsTemplateOptionDto = makeSerializer(OdsTemplateOptionDto);

export class OdsRowCountsDto {
  @Expose()
  Schema: string;
  @Expose()
  Table: string;
  @Expose()
  RecordCount: number;
  @Expose()
  FirstCreated: Date;
  @Expose()
  LastCreated: Date;
  @Expose()
  LastUpdated: Date;

  @Expose()
  get id() {
    return `${this.Schema}.${this.Table}`;
  }
}
export const toOdsRowCountsDto = makeSerializer(OdsRowCountsDto);

export class GetOdsDto
  extends DtoGetBase
  implements GetDto<IOds, 'ownerships' | 'edfiTenant' | 'edorgs'>
{
  @Expose()
  edfiTenantId: number;

  @Expose()
  sbEnvironmentId: number;

  @Expose()
  dbName: string;

  @Expose()
  odsInstanceId: number | null;

  @Expose()
  odsInstanceName: string | null;

  override get displayName() {
    return this.odsInstanceName ?? this.dbName;
  }
}
export const toGetOdsDto = makeSerializer(GetOdsDto);

export class PutOdsDto
  extends DtoPutBase
  implements
    PutDto<
      IOds,
      | 'ownerships'
      | 'edfiTenant'
      | 'edorgs'
      | 'dbName'
      | 'odsInstanceId'
      | 'sbEnvironmentId'
      | 'odsInstanceName'
    >
{
  @Expose()
  edfiTenantId: number;
  @Expose()
  @TrimWhitespace()
  name: string;
}

export class PostOdsDto
  extends DtoPostBase
  implements
    PostDto<
      IOds,
      | 'ownerships'
      | 'edfiTenant'
      | 'edorgs'
      | 'dbName'
      | 'odsInstanceId'
      | 'sbEnvironmentId'
      | 'edfiTenantId'
      | 'odsInstanceName'
    >
{
  @Expose()
  @MinLength(3)
  @MaxLength(29)
  @Matches(/^[a-z0-9]+$/, { message: 'Name must only contain numbers and lowercase letters.' })
  @TrimWhitespace()
  name: string;

  @Expose()
  @TrimWhitespace()
  templateName: string;
}
