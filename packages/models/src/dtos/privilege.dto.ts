import { Expose } from 'class-transformer';
import type { PrivilegeCode } from '..';
import { IPrivilege } from '../interfaces/privilege.interface';
import { GetDto } from '../utils/get-base.dto';
import { makeSerializer } from '../utils/make-serializer';

export class GetPrivilegeDto implements GetDto<IPrivilege> {
  @Expose()
  name: string;
  @Expose()
  description: string;
  @Expose()
  code: PrivilegeCode;

  get displayName() {
    return this.name;
  }
  get id() {
    return this.code;
  }
}
export const toGetPrivilegeDto = makeSerializer<GetPrivilegeDto, GetDto<IPrivilege>>(
  GetPrivilegeDto
);
