import { Expose } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import type { IIntegrationProvider } from '../interfaces';
import { TrimWhitespace } from '../utils';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetIntegrationProviderDto
  extends DtoGetBase
  implements GetDto<IIntegrationProvider, 'ownerships' | 'integrationApps'>
{
  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  appCount?: number;
}
export const toGetIntegrationProviderDto = makeSerializer(GetIntegrationProviderDto);

export class PutIntegrationProviderDto
  extends DtoPutBase
  implements PutDto<IIntegrationProvider, 'ownerships' | 'integrationApps'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  description: string;
}

export class PostIntegrationProviderDto
  extends DtoPostBase
  implements PostDto<IIntegrationProvider, 'ownerships' | 'integrationApps'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;

  @Expose()
  @IsString()
  @TrimWhitespace()
  description: string;
}
