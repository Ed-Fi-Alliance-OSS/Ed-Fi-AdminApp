// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiCopy } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Copy({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiCopy} {...rest} />;
}
Copy.displayName = 'Copy';
Copy.purpose = 'Copy text';
