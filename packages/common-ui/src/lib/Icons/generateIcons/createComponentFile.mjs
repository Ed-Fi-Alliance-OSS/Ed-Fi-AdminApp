import fs from 'fs';
import { GENERATED_FOLDER, TEMPLATE_WARNING } from './generateIcons.constants.mjs';

export function createComponentFile(iconLine) {
  const [componentName, purpose, iconName, iconFillName] = iconLine.split(/\s*,\s*/g);
  const iconPackage = iconName.slice(0, 2).toLowerCase();

  const hasFilledIcon = iconFillName !== 'undefined' && iconFillName !== '';
  const iconAsValue = hasFilledIcon ? `isFilled ? ${iconFillName} : ${iconName}` : iconName;

  const content = `
    ${TEMPLATE_WARNING}
    import { Icon } from '@chakra-ui/icon';
    import { ${iconName}, ${iconFillName ?? ''} } from 'react-icons/${iconPackage}';
    import type { IconProps } from '../types';

    export function ${componentName}({ isFilled, ...rest }: IconProps) {
      return <Icon as={${iconAsValue}} {...rest} />;
    };
    ${componentName}.displayName = '${componentName}';
    ${componentName}.purpose = '${purpose}';
  `;

  fs.writeFileSync(`./${GENERATED_FOLDER}/${componentName}.tsx`, content);

  return componentName;
}
