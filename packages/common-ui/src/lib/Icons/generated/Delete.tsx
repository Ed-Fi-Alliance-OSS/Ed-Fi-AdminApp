// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiTrash } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Delete({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiTrash} {...rest} />;
}
Delete.displayName = 'Delete';
Delete.purpose = 'Delete resource / remove selection';
