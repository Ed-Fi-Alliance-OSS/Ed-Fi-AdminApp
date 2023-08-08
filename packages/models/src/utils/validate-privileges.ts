import { registerDecorator } from 'class-validator';
import { PrivilegeCode, privilegeCodes } from '../types/privilege.type';

export const privilegeDependencies: Partial<
  Record<PrivilegeCode, { dependencies: PrivilegeCode[]; message: string }>
> = {
  'ods:read': {
    dependencies: ['sbe:read'],
    message: 'All ODS features require the ability to also access SBEs.',
  },
  'edorg:read': {
    dependencies: ['sbe:read', 'ods:read'],
    message: 'All Ed-Org features require the ability to also access SBEs and ODSs.',
  },
  'ownership:create': {
    dependencies: ['sbe:read', 'ods:read', 'edorg:read', 'role:read', 'ownership:read'],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:read': {
    dependencies: ['sbe:read', 'ods:read', 'edorg:read', 'role:read'],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:update': {
    dependencies: ['sbe:read', 'ods:read', 'edorg:read', 'role:read', 'ownership:read'],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'ownership:delete': {
    dependencies: ['sbe:read', 'ods:read', 'edorg:read', 'role:read', 'ownership:read'],
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
  'tenant.sbe.ods:read': {
    dependencies: ['tenant.sbe:read'],
    message: 'All ODS features require the ability to also access SBEs.',
  },
  'tenant.sbe.edorg:read': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.ods:read'],
    message: 'All Ed-Org features require the ability to also access SBEs and ODSs.',
  },
  'tenant.sbe.edorg.application:read': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.ods:read', 'tenant.sbe.edorg:read'],
    message: 'All Application features require the ability to also access SBEs, ODSs, and Ed-Orgs.',
  },
  'tenant.sbe.edorg.application:create': {
    dependencies: [
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
      'tenant.sbe.edorg:read',
      'tenant.sbe.edorg.application:read',
    ],
    message: 'All Application features require the ability to also access SBEs, ODSs, and Ed-Orgs.',
  },
  'tenant.sbe.edorg.application:delete': {
    dependencies: [
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
      'tenant.sbe.edorg:read',
      'tenant.sbe.edorg.application:read',
    ],
    message: 'All Application features require the ability to also access SBEs, ODSs, and Ed-Orgs.',
  },
  'tenant.sbe.edorg.application:update': {
    dependencies: [
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
      'tenant.sbe.edorg:read',
      'tenant.sbe.edorg.application:read',
    ],
    message: 'All Application features require the ability to also access SBEs, ODSs, and Ed-Orgs.',
  },
  'tenant.sbe.edorg.application:reset-credentials': {
    dependencies: [
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
      'tenant.sbe.edorg:read',
      'tenant.sbe.edorg.application:read',
    ],
    message: 'All Application features require the ability to also access SBEs, ODSs, and Ed-Orgs.',
  },
  'tenant.sbe.claimset:read': {
    dependencies: ['tenant.sbe:read'],
    message: 'All Claimset features require the ability to also access SBEs.',
  },
  'tenant.sbe.claimset:update': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.claimset:read'],
    message: 'All Claimset features require the ability to also access SBEs.',
  },
  'tenant.sbe.claimset:create': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.claimset:read'],
    message: 'All Claimset features require the ability to also access SBEs.',
  },
  'tenant.sbe.claimset:delete': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.claimset:read'],
    message: 'All Claimset features require the ability to also access SBEs.',
  },
  'tenant.sbe.vendor:read': {
    dependencies: ['tenant.sbe:read'],
    message: 'All Vendor features require the ability to also access SBEs.',
  },
  'tenant.sbe.vendor:update': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.vendor:read'],
    message: 'All Vendor features require the ability to also access SBEs.',
  },
  'tenant.sbe.vendor:create': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.vendor:read'],
    message: 'All Vendor features require the ability to also access SBEs.',
  },
  'tenant.sbe.vendor:delete': {
    dependencies: ['tenant.sbe:read', 'tenant.sbe.vendor:read'],
    message: 'All Vendor features require the ability to also access SBEs.',
  },
  'tenant.ownership:read': {
    dependencies: [
      'tenant.sbe:read',
      'tenant.sbe.ods:read',
      'tenant.sbe.edorg:read',
      'tenant.role:read',
    ],
    message:
      'All Ownership features require the ability to also access the several other kinds of data involved in management of ownerships.',
  },
  'tenant.role:create': {
    dependencies: ['tenant.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'tenant.role:read': {
    dependencies: [],
    message: 'All Role features require the ability to also access privileges.',
  },
  'tenant.role:update': {
    dependencies: ['tenant.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'tenant.role:delete': {
    dependencies: ['tenant.role:read'],
    message: 'All Role features require the ability to also access privileges.',
  },
  'tenant.user:read': {
    dependencies: ['tenant.role:read'],
    message: 'All User features require the ability to also access privileges and roles.',
  },
};
const privilegeCodesSet = new Set(privilegeCodes);

export type DependencyErrors = Partial<Record<PrivilegeCode, string>>;

const validate = (value: string[]) => {
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
