import fs from 'fs';
import { GENERATED_FOLDER, TEMPLATE_WARNING } from './generateIcons.constants.mjs';

export function createIndexFile() {
  const filesList = fs.readdirSync(GENERATED_FOLDER).filter((file) => file.endsWith('.tsx'));
  const exports = filesList.map((fileName) => {
    const componentName = fileName.replace('.tsx', '');
    return `export { ${componentName} } from './${componentName}';`;
  });

  const content = `
    ${TEMPLATE_WARNING}
    ${exports.join('\n')}
  `;

  fs.writeFileSync(`${GENERATED_FOLDER}/index.ts`, content);
}
