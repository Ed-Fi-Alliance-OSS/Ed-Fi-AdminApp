// This file was generated using "npm run generate:icons". Do not edit directly.

import { Icon } from '@chakra-ui/icon';
import { BsInboxes, BsInboxesFill } from 'react-icons/bs';
import type { IconProps } from '../types';

export function SyncQueue({ isFilled, ...rest }: IconProps) {
  return <Icon as={isFilled ? BsInboxesFill : BsInboxes} {...rest} />;
}
SyncQueue.displayName = 'SyncQueue';
SyncQueue.purpose = 'Menu item';
