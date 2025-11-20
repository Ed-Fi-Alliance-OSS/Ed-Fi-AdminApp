// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsBuilding, BsBuildingFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Vendor({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsBuildingFill : BsBuilding} {...rest} />;
}
Vendor.displayName = 'Vendor';
Vendor.purpose = 'Menu item';
