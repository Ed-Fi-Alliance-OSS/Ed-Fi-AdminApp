// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiIdCard } from 'react-icons/bi';
import type { IconProps } from '../types';

export function IdCard({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiIdCard} {...rest} />;
}
IdCard.displayName = 'IdCard';
IdCard.purpose = 'Add this user to team';
