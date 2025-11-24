// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsBuildings, BsBuildingsFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Team({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsBuildingsFill : BsBuildings} {...rest} />;
}
Team.displayName = 'Team';
Team.purpose = 'Menu item';
