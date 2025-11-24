// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiEdit } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Edit({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiEdit} {...rest} />;
}
Edit.displayName = 'Edit';
Edit.purpose = 'Edit resource';
