// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsShieldLock, BsShieldLockFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Claimset({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsShieldLockFill : BsShieldLock} {...rest} />;
}
Claimset.displayName = 'Claimset';
Claimset.purpose = 'Menu item';
