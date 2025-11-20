// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsHouseDoor, BsHouseDoorFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Home({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsHouseDoorFill : BsHouseDoor} {...rest} />;
}
Home.displayName = 'Home';
Home.purpose = 'Menu item';
