// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiCog } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Cog({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiCog} {...rest} />;
}
Cog.displayName = 'Cog';
Cog.purpose = 'Connect to Admin API';
