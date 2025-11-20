import { IPrivilege } from '@edanalytics/models';
import set from 'lodash/set';

export type PrivilegeNest = Partial<{ [code: string]: PrivilegeNest }>;
export const nestPrivileges = (privileges: IPrivilege[]) =>
  privileges.reduce<PrivilegeNest>((acc, { code }) => {
    const [path] = code.split(':');
    const pathArr = path.split('.');
    set(acc, [...pathArr, code], {});
    return acc;
  }, {});
