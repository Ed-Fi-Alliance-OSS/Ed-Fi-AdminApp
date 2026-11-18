// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsBoxSeam, BsBoxSeamFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function MyProducts({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsBoxSeamFill : BsBoxSeam} {...rest} />;
}
MyProducts.displayName = 'MyProducts';
MyProducts.purpose = 'Menu item';
