// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiShieldX } from 'react-icons/bi';
import type { IconProps } from '../types';

export function ShieldX({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiShieldX} {...rest} />;
}
ShieldX.displayName = 'ShieldX';
ShieldX.purpose = 'Reset application credentials';
