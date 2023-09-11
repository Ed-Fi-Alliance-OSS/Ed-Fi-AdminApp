import {
  Avatar,
  Button,
  HStack,
  Icon,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react';
import { useAtomValue } from 'jotai';
import { RxCaretDown } from 'react-icons/rx';
import { Link as RouterLink } from 'react-router-dom';
import logoUrl from '../../assets/starting-blocks.svg';
import { apiClient, useMe, useMyTenants } from '../api';
import { asTenantIdAtom } from './Nav';

export const AppBar = () => {
  const me = useMe();

  const asId = useAtomValue(asTenantIdAtom);
  const tenants = useMyTenants();
  const tenant = asId === undefined ? undefined : tenants.data?.[asId];

  return (
    <HStack
      zIndex={2}
      as="header"
      justify="space-between"
      w="100%"
      position="sticky"
      top="0px"
      bg="foreground-bg"
      py={1}
      px={3}
    >
      <HStack>
        <RouterLink to={asId ? `/as/${asId}` : '/'}>
          <Image alt="logo" h="28px" w="238px" src={logoUrl} />
        </RouterLink>
        <Text
          lineHeight="1.3"
          borderLeft="1px solid"
          borderColor="gray.300"
          ml="0.9ch"
          pl="1.5ch"
          fontWeight={600}
          fontSize="lg"
          color="gray.600"
        >
          {tenant?.displayName ?? 'Global scope'}
        </Text>
      </HStack>
      <Menu>
        <MenuButton as={Button} variant="unstyled">
          <HStack spacing={0}>
            <Avatar name={me.data?.fullName} size="sm" />
            <Icon as={RxCaretDown} />
          </HStack>
        </MenuButton>
        <MenuList>
          <MenuItem
            onClick={() => {
              apiClient.post('/auth/logout', {}).then(() => {
                window.location.href = window.location.origin;
              });
            }}
          >
            Sign out
          </MenuItem>
          {me.data?.role ? (
            <MenuItem to="/account" as={RouterLink}>
              My profile
            </MenuItem>
          ) : null}
        </MenuList>
      </Menu>
    </HStack>
  );
};
