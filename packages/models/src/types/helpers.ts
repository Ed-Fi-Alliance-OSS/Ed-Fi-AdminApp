import { PrivilegeResources, privilegeCodes } from './privileges';

export const resourcePrivileges = (resource: PrivilegeResources) =>
  privilegeCodes.filter((code) => code.startsWith(resource));
