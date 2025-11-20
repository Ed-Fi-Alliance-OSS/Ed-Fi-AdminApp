// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsFunnel, BsFunnelFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Funnel({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsFunnelFill : BsFunnel} {...rest} />;
}
Funnel.displayName = 'Funnel';
Funnel.purpose = 'For filters';
