// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPersonBadge, BsPersonBadgeFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function TeamMembership({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPersonBadgeFill : BsPersonBadge} {...rest} />;
}
TeamMembership.displayName = 'TeamMembership';
TeamMembership.purpose = 'Menu item';
