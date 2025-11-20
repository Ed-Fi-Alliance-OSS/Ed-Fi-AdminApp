// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsCheckAll } from 'react-icons/bs';
import type { IconProps } from '../types';

export function CheckAll({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BsCheckAll} {...rest} />;
}
CheckAll.displayName = 'CheckAll';
CheckAll.purpose = 'Has all privileges';
