// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiRefresh } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Refresh({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiRefresh} {...rest} />;
}
Refresh.displayName = 'Refresh';
Refresh.purpose = 'Refresh tenants';
