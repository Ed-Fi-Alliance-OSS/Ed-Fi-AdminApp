// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsClock, BsClockFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function RunHistory({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsClockFill : BsClock} {...rest} />;
}
RunHistory.displayName = 'RunHistory';
RunHistory.purpose = 'Menu item';
