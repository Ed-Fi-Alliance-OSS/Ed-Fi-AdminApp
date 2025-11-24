// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiPlus } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Plus({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiPlus} {...rest} />;
}
Plus.displayName = 'Plus';
Plus.purpose = 'Create resource / show filters';
