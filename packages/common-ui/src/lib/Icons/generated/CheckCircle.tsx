// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsCheckCircle } from 'react-icons/bs';
import type { IconProps } from '../types';

export function CheckCircle({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BsCheckCircle} {...rest} />;
}
CheckCircle.displayName = 'CheckCircle';
CheckCircle.purpose = 'Copy text success';
