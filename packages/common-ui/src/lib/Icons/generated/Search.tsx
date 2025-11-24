// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BiSearch } from 'react-icons/bi';
import type { IconProps } from '../types';

export function Search({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BiSearch} {...rest} />;
}
Search.displayName = 'Search';
Search.purpose = 'Search';
