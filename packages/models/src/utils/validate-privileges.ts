import { registerDecorator } from 'class-validator';
import { TrimWhitespace } from '../utils';
import { PRIVILEGE_CODES } from '../types/privilege.type';
import { PrivilegeCode } from '../types';

export const privilegeDependencies: Partial<
  Record<PrivilegeCode, { dependencies: PrivilegeCode[]; message: string }>
> = {
  'ods:read': {
    dependencies: ['sb-environment.edfi-tenant:read'],
    message: 'All ODS features require the ability to also access EdfiTenants.',
  },
  'ods:read-row-counts': {
    dependencies: ['ods:read'],
    message: 'All ODS features require the ability to also access ODSs.',
  },
  'edorg:read': {
    dependencies: ['sb-environment.edfi-tenant:read', 'ods:read'],
    message: 'All Ed-Org features require the ability to also access EdfiTenants and ODSs.',
  },
  'ownership:create': {
    dependencies: [
      'sb-environment.edfi-tenant:read',
      'ods:read',
      'edorg:read',
      'role:read',
      'ownership:read',
    ],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:read': {
    dependencies: ['sb-environment.edfi-tenant:read', 'ods:read', 'edorg:read', 'role:read'],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:update': {
    dependencies: [
      'sb-environment.edfi-tenant:read',
      'ods:read',
      'edorg:read',
      'role:read',
      'ownership:read',
    ],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:delete': {
    dependencies: [
      'sb-environment.edfi-tenant:read',
      'ods:read',
      'edorg:read',
      'role:read',
      'ownership:read',
    ],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'role:create': {
    dependencies: ['role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'role:read': {
    dependencies: [],
    message: 'All Role features require the ability to also access privileges.',
  },
  'role:update': {
    dependencies: ['role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'role:delete': {
    dependencies: ['role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user:create': {
    dependencies: ['role:read', 'user:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user:read': {
    dependencies: ['role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user:update': {
    dependencies: ['role:read', 'user:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user:delete': {
    dependencies: ['role:read', 'user:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user-team-membership:create': {
    dependencies: ['role:read', 'user:read', 'user-team-membership:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user-team-membership:read': {
    dependencies: ['role:read', 'user:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user-team-membership:update': {
    dependencies: ['role:read', 'user:read', 'user-team-membership:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'user-team-membership:delete': {
    dependencies: ['role:read', 'user:read', 'user-team-membership:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'team.sb-environment.edfi-tenant.ods:read': {
    dependencies: ['team.sb-environment.edfi-tenant:read'],
    message: 'All ODS features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.ods:read-row-counts': {
    dependencies: ['team.sb-environment.edfi-tenant.ods:read'],
    message: 'All ODS features require the ability to also access ODSs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg:read': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
    ],
    message: 'All Ed-Org features require the ability to also access EdfiTenants and ODSs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg.application:read': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message:
      'All Application features require the ability to also access EdfiTenants, ODSs, and Ed-Orgs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg.application:create': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message:
      'All Application features require the ability to also access EdfiTenants, ODSs, and Ed-Orgs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg.application:delete': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message:
      'All Application features require the ability to also access EdfiTenants, ODSs, and Ed-Orgs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg.application:update': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message:
      'All Application features require the ability to also access EdfiTenants, ODSs, and Ed-Orgs.',
  },
  'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      'team.sb-environment.edfi-tenant.vendor:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message:
      'All Application features require the ability to also access EdfiTenants, ODSs, and Ed-Orgs.',
  },
  'team.sb-environment.edfi-tenant.claimset:read': {
    dependencies: ['team.sb-environment.edfi-tenant:read'],
    message: 'All Claimset features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.claimset:update': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message: 'All Claimset features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.claimset:create': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message: 'All Claimset features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.claimset:delete': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.claimset:read',
    ],
    message: 'All Claimset features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.vendor:read': {
    dependencies: ['team.sb-environment.edfi-tenant:read'],
    message: 'All Vendor features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.vendor:update': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.vendor:read',
    ],
    message: 'All Vendor features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.vendor:create': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.vendor:read',
    ],
    message: 'All Vendor features require the ability to also access EdfiTenants.',
  },
  'team.sb-environment.edfi-tenant.vendor:delete': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.vendor:read',
    ],
    message: 'All Vendor features require the ability to also access EdfiTenants.',
  },
  'team.ownership:read': {
    dependencies: [
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.edorg:read',
      'team.role:read',
    ],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'team.role:create': {
    dependencies: ['team.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'team.role:read': {
    dependencies: [],
    message: 'All Role features require the ability to also access privileges.',
  },
  'team.role:update': {
    dependencies: ['team.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'team.role:delete': {
    dependencies: ['team.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'team.user:read': {
    dependencies: ['team.role:read'],
    message: 'All User features require the ability to also access privileges and roles.',
  },
};
const privilegeCodesSet = new Set(PRIVILEGE_CODES);

export type DependencyErrors = Partial<Record<PrivilegeCode, string>>;

const validate = (value: PrivilegeCode[] | undefined) => {
  if (!value) {
    return 'Privileges are required.';
  }
  const invalidPrivileges = value.filter((p) => !privilegeCodesSet.has(p));
  if (invalidPrivileges.length) {
    throw new Error('Invalid privileges should be caught by built-in validation decorator');
  }
  const valueSet = new Set(value);

  const missingDependencyErrors = value.reduce<DependencyErrors>((acc, p) => {
    const missingDependencies = (
      privilegeDependencies[p as PrivilegeCode]?.dependencies ?? []
    ).filter((d) => !valueSet.has(d));
    if (missingDependencies.length) {
      acc[p as PrivilegeCode] = `${
        privilegeDependencies[p as PrivilegeCode]?.message
      } Missing: ${missingDependencies.join(', ')}.`;
    }
    return acc;
  }, {});

  if (Object.keys(missingDependencyErrors).length) {
    return JSON.stringify(missingDependencyErrors);
  } else {
    return true;
  }
};

export function IsValidPrivileges() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPrivileges',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: (args) => {
          return validate(args.value) as any;
        },
      },
      validator: {
        validate: (value) => (validate(value) === true ? true : false),
      },
    });
  };
}
