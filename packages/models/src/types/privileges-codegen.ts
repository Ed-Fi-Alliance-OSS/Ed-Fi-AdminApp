import { privileges } from './privileges-source';
import { names } from '@nx/devkit';
import fs from 'fs';

/*
 TODO WIP code-gen.

 This file, privileges.ts, and privileges-source.ts are a WIP refactor
 away from the other files in this folder which are a mixture of
 derived types, hand-written objects, and dynamic helpers. There's a
 bunch of redundancy which should be eliminated over the long run. At
 the moment what's in the way is a) just doing it, and b) exceptions
 to the rules that codegen would have to follow.
*/

let output = `import { privileges } from './privileges-source';

export type PrivilegeCode = keyof typeof privileges;
export const privilegeCodes = Object.keys(privileges) as PrivilegeCode[];
export const privilegesArray = privilegeCodes.map((key) => ({
  code: key,
  description: privileges[key],
}));
`;

const generatePrivilegeTypes = () => {
  let entityPrivileges: Record<string, string[]> = {};
  const _generateTypes = (depth: number) => {
    let countNew = 0;
    entityPrivileges = Object.keys(privileges).reduce((acc, key) => {
      const entityLevels = key.split('.');
      if (entityLevels.length >= depth + 1) {
        countNew++;
        const entityName = entityLevels
          .slice(0, depth)
          .map((kebabCaseName) => names(kebabCaseName).className)
          .join('');
        acc[entityName] = acc[entityName]?.concat([key]) ?? [key];
      }
      return acc;
    }, entityPrivileges);
    if (countNew > 0) {
      _generateTypes(depth + 1);
    }
  };
  _generateTypes(1);
  Object.keys(entityPrivileges).forEach((entityName) => {
    output += `export type ${entityName}Privileges =\n  | ${entityPrivileges[entityName]
      .map((privilege) => `'${privilege}'`)
      .join('\n  | ')};\n\n`;
  });
};

generatePrivilegeTypes();

const generateResourcePrivilegeMaps = () => {
  let entityPrivileges: Record<string, Record<string, string[]>> = {};
  const _generateResourcePrivilegeMaps = (depth: number) => {
    let countNew = 0;
    entityPrivileges = Object.keys(privileges).reduce((acc, key) => {
      const entityLevels = key.split('.');
      if (entityLevels.length >= depth + 1) {
        countNew++;
        const entityName = entityLevels
          .slice(0, depth)
          .map((kebabCaseName) => names(kebabCaseName).className)
          .join('');
        const resourceName = key.split(':')[0];
        if (acc[entityName] === undefined) {
          acc[entityName] = {};
        }
        if (acc[entityName][resourceName] === undefined) {
          acc[entityName][resourceName] = [];
        }
        acc[entityName][resourceName] = acc[entityName][resourceName].concat([key]) ?? [key];
      }
      return acc;
    }, entityPrivileges);
    if (countNew > 0) {
      _generateResourcePrivilegeMaps(depth + 1);
    }
  };
  _generateResourcePrivilegeMaps(1);
  Object.keys(entityPrivileges).forEach((entityName) => {
    output += `export const ${entityName}ResourcePrivileges = {\n  ${Object.entries(
      entityPrivileges[entityName]
    )
      .map(
        ([resource, privileges]) => `'${resource}': [\n    '${privileges.join("',\n    '")}',\n  ]`
      )
      .join(',\n  ')},\n};\n\n`;
  });
};

generateResourcePrivilegeMaps();

const generateResourceTypes = () => {
  output += `export type PrivilegeResources =\n  | ${[
    ...new Set(Object.keys(privileges).map((key) => `'${key.split(':')[0]}'`)).values(),
  ].join('\n  | ')};\n\n`;
};

generateResourceTypes();

fs.writeFileSync(__dirname + '/privileges.ts', output);
