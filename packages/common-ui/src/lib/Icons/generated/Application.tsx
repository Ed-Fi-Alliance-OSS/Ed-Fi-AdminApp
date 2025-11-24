// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsKey, BsKeyFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Application({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsKeyFill : BsKey} {...rest} />;
}
Application.displayName = 'Application';
Application.purpose = 'Menu item';
