import fs from 'fs';
import { GENERATED_FOLDER, TEMPLATE_WARNING } from './generateIcons.constants.mjs';

export function createStorybookConstantsFile(iconGroups) {
  const imports = `
    import {
      ${Object.values(iconGroups)
        .map(({ icons }) => icons)
        .flat()
        .sort()
        .join(',\n')}
    } from './index';
  `;
  const groups = Object.entries(iconGroups)
    .map(
      ([variableName, { icons, name }]) => `
        const ${variableName} = {
          icons: [${icons.join(',')}] as IconType[],
          name: '${name}',
        };
      `
    )
    .join('\n\n');

  const content = `
    ${TEMPLATE_WARNING}

    ${imports}

    import type { IconType } from '../types';

    ${groups}

    export const allIcons = [${Object.keys(iconGroups).join(',')}];
  `;

  fs.writeFileSync(`${GENERATED_FOLDER}/stories.constants.ts`, content);
}
