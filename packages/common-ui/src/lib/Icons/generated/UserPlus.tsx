// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiUserPlus } from 'react-icons/bi';
import type { IconProps } from '../types';

export function UserPlus({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiUserPlus} {...rest} />;
}
UserPlus.displayName = 'UserPlus';
UserPlus.purpose = 'Add user to this team';
