// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPerson, BsPersonFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Account({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPersonFill : BsPerson} {...rest} />;
}
Account.displayName = 'Account';
Account.purpose = 'Menu item';
