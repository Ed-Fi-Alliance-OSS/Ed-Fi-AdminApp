// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPersonVcard, BsPersonVcardFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Role({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPersonVcardFill : BsPersonVcard} {...rest} />;
}
Role.displayName = 'Role';
Role.purpose = 'Menu item';
