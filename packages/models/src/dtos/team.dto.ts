import { Expose } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { ITeam } from '../interfaces/team.interface';
import { DtoGetBase, GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';
import { DtoPostBase, PostDto } from '../utils/post-base.dto';
import { DtoPutBase, PutDto } from '../utils/put-base.dto';

export class GetTeamDto
  extends DtoGetBase
  implements GetDto<ITeam, 'userTeamMemberships' | 'ownerships' | 'roles'>
{
  @Expose()
  name: string;

  override get displayName() {
    return this.name;
  }
}
export const toGetTeamDto = makeSerializer(GetTeamDto);

export class PutTeamDto
  extends DtoPutBase
  implements PutDto<ITeam, 'userTeamMemberships' | 'ownerships' | 'roles'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;
}

export class PostTeamDto
  extends DtoPostBase
  implements PostDto<ITeam, 'userTeamMemberships' | 'ownerships' | 'roles'>
{
  @Expose()
  @IsString()
  @MinLength(3)
  @TrimWhitespace()
  name: string;
}
