import { BsCloudRain, BsCloudRainFill } from 'react-icons/bs';
import { BsDatabase, BsDatabaseFill } from 'react-icons/bs';
import { Box, Text } from '@chakra-ui/react';
import {
  AnyRoute,
  AnyRoutesInfo,
  RouteMatch,
  useRouter,
} from '@tanstack/router';
import { Resizable } from 're-resizable';
import {
  BsClipboard,
  BsClipboardFill,
  BsGear,
  BsGearFill,
  BsPerson,
  BsPersonFill,
} from 'react-icons/bs';
import { HiHome, HiOutlineHome } from 'react-icons/hi';
import {
  accountRoute,
  indexRoute,
  usersRoute,
  tenantsRoute,
  resourcesRoute,
  odssRoute,
  sbesRoute,
  edorgsRoute,
  sbeRoute,
  userTenantMembershipsRoute,
  rolesRoute,
  ownershipsRoute,
} from '../routes';
import { INavButtonProps, NavButton } from './NavButton';
import _ from 'lodash';
import { useSbes } from '../api';

export const Nav = () => {
  const sbes = useSbes();

  const items: INavButtonProps[] = [
    {
      route: usersRoute,
      icon: BsPerson,
      activeIcon: BsPersonFill,
      text: 'Users',
    },
    {
      route: tenantsRoute,
      icon: BsClipboard,
      activeIcon: BsClipboardFill,
      text: 'Tenants',
    },
    {
      route: resourcesRoute,
      icon: BsGear,
      activeIcon: BsGearFill,
      text: 'Ownerships',
    },
    {
      route: sbesRoute,
      icon: BsGear,
      activeIcon: BsGearFill,
      text: 'Environments',
      childItems: Object.values(sbes.data || {}).map((sbe) => ({
        route: sbeRoute,
        params: { sbeId: String(sbe.id) },
        icon: BsPerson,
        activeIcon: BsPersonFill,
        text: sbe.displayName,
        childItems: [
          {
            route: odssRoute,
            params: { sbeId: String(sbe.id) },
            icon: BsDatabase,
            activeIcon: BsDatabaseFill,
            text: 'ODSs',
          },
          {
            route: edorgsRoute,
            params: { sbeId: String(sbe.id) },
            icon: BsCloudRain,
            activeIcon: BsCloudRainFill,
            text: 'Ed-Orgs',
          },
        ],
      })),
    },
    {
      route: userTenantMembershipsRoute,
      icon: BsCloudRain,
      activeIcon: BsCloudRainFill,
      text: 'UserTenantMemberships',
    },
    {
      route: rolesRoute,
      icon: BsGear,
      activeIcon: BsGearFill,
      text: 'Roles',
    },
    {
      route: ownershipsRoute,
      icon: BsClipboard,
      activeIcon: BsClipboardFill,
      text: 'Ownerships',
    },
  ];

  const staticItems: INavButtonProps[] = [
    {
      route: indexRoute,
      icon: HiOutlineHome,
      activeIcon: HiHome,
      text: 'Home',
    },
    {
      route: accountRoute,
      icon: BsPerson,
      activeIcon: BsPersonFill,
      text: 'Account',
    },
  ];
  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap((ci) => flatten(ci)),
  ];
  const flatItems = [...items, ...staticItems].flatMap((item) => flatten(item));

  let deepestMatch = null;
  const router = useRouter();

  const isMatch = <
    M extends Pick<RouteMatch<AnyRoutesInfo, AnyRoute>, 'params' | 'route'>
  >(
    activeRoute: M,
    item: INavButtonProps
  ) => {
    const itemParams = item.params || {};
    const paramsEqual = _.isMatch(activeRoute.params, itemParams);
    const sameRoute = item.route.id === activeRoute.route.id;

    return sameRoute && paramsEqual;
  };

  router.state.currentMatches.forEach((m) => {
    if (flatItems.some((item) => isMatch(m, item))) {
      deepestMatch = m;
    }
  });

  const tagMatch = <
    M extends Pick<RouteMatch<AnyRoutesInfo, AnyRoute>, 'params' | 'route'>
  >(
    items: INavButtonProps[],
    match: M | null
  ): INavButtonProps[] =>
    match === null
      ? items
      : items.map((item) => ({
          ...item,
          isActive: isMatch(match, item),
          childItems: tagMatch(item.childItems || [], match),
        }));

  return (
    <Box
      py={3}
      flex="0 0 15em"
      overflowX="hidden"
      overflowY="auto"
      bg="rgb(248,248,248)"
      borderRight="1px solid"
      borderColor="gray.200"
      enable={{ right: true }}
      defaultSize={{ width: '15em', height: '100%' }}
      minWidth="5em"
      maxWidth="min(40em, 80%)"
      as={Resizable}
    >
      <Text px={3} as="h3" color="gray.500" mb={2} fontWeight="600">
        Pages
      </Text>
      {tagMatch(staticItems, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route.fullPath} {...item} />
      ))}
      <Text px={3} mt={4} as="h3" color="gray.500" mb={2} fontWeight="600">
        Resources
      </Text>
      {tagMatch(items, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route.fullPath} {...item} />
      ))}
    </Box>
  );
};
