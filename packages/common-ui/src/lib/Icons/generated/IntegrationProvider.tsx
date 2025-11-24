// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsPuzzle, BsPuzzleFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function IntegrationProvider({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsPuzzleFill : BsPuzzle} {...rest} />;
}
IntegrationProvider.displayName = 'IntegrationProvider';
IntegrationProvider.purpose = 'Menu item';
