import fs from 'fs';
import { createComponentFile } from './createComponentFile.mjs';
import { ICONS_LIST_FILE } from './generateIcons.constants.mjs';

export function createAllComponentFiles() {
  // .slice(1) skips the header line in the iconsList.txt file
  const iconsList = fs.readFileSync(`./${ICONS_LIST_FILE}`, 'utf-8').split('\n').slice(1);

  let currentIconGroup = '';
  const iconGroups = {};

  iconsList.forEach((rawIconLine) => {
    const iconLine = rawIconLine.trim();
    if (iconLine) {
      if (iconLine.startsWith('//')) {
        const groupNameLine = iconLine.replace('//', '').trim();
        const iconGroup = groupNameLine
          .split(/\s+/g)
          .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
          .join('');
        currentIconGroup = iconGroup;
        iconGroups[currentIconGroup] = { icons: [], name: groupNameLine };
      } else {
        const componentName = createComponentFile(iconLine);
        iconGroups[currentIconGroup].icons.push(componentName);
      }
    }
  });

  return iconGroups;
}
