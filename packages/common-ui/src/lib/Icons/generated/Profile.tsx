// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsFileEarmarkDiff, BsFileEarmarkDiffFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function Profile({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsFileEarmarkDiffFill : BsFileEarmarkDiff} {...rest} />;
}
Profile.displayName = 'Profile';
Profile.purpose = 'Menu item';
