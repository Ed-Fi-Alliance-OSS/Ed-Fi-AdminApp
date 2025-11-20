// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPeople, BsPeopleFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function User({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPeopleFill : BsPeople} {...rest} />;
}
User.displayName = 'User';
User.purpose = 'Menu item';
