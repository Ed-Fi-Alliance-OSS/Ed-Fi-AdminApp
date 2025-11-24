// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsInfoCircle } from 'react-icons/bs';
import type { IconProps } from '../types';

export function InfoCircle({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? undefined : BsInfoCircle} {...rest} />;
}
InfoCircle.displayName = 'InfoCircle';
InfoCircle.purpose = 'For tooltips';
