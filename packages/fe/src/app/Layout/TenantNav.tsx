import { Text } from '@chakra-ui/react';
import {
  AnyRoute,
  AnyRoutesInfo,
  RouteMatch,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/router';
import _ from 'lodash';
import {
  BsClipboard,
  BsClipboardFill,
  BsCloudRain,
  BsCloudRainFill,
  BsDatabase,
  BsDatabaseFill,
  BsGear,
  BsGearFill,
  BsPerson,
  BsPersonFill,
} from 'react-icons/bs';
import { HiHome, HiOutlineHome } from 'react-icons/hi';
import { useTenantSbes, useTenants } from '../api';
import {
  asRoute,
  edorgsRoute,
  odssRoute,
  ownershipsRoute,
  rolesRoute,
  sbeRoute,
  sbesRoute,
  usersRoute,
} from '../routes';
import { INavButtonProps, NavButton } from './NavButton';

export const TenantNav = (props: { tenantId: string }) => {
  const sbes = useTenantSbes(props.tenantId);

  const items: INavButtonProps[] = [
    {
      route: sbesRoute,
      params: { asId: props.tenantId },
      icon: BsGear,
      activeIcon: BsGearFill,
      text: 'Environments',
      childItems: Object.values(sbes.data || {}).map((sbe) => ({
        route: sbeRoute,
        params: { asId: props.tenantId, sbeId: String(sbe.id) },
        icon: BsPerson,
        activeIcon: BsPersonFill,
        text: sbe.displayName,
        childItems: [
          {
            route: odssRoute,
            params: { asId: props.tenantId, sbeId: String(sbe.id) },
            icon: BsDatabase,
            activeIcon: BsDatabaseFill,
            text: 'ODSs',
          },
          {
            route: edorgsRoute,
            params: { asId: props.tenantId, sbeId: String(sbe.id) },
            icon: BsCloudRain,
            activeIcon: BsCloudRainFill,
            text: 'Ed-Orgs',
          },
        ],
      })),
    },
    {
      route: usersRoute,
      params: { asId: props.tenantId },
      icon: BsCloudRain,
      activeIcon: BsCloudRainFill,
      text: 'Users',
    },
    {
      route: rolesRoute,
      params: { asId: props.tenantId },
      icon: BsGear,
      activeIcon: BsGearFill,
      text: 'Roles',
    },
    {
      route: ownershipsRoute,
      params: { asId: props.tenantId },
      icon: BsClipboard,
      activeIcon: BsClipboardFill,
      text: 'Ownerships',
    },
  ];

  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap((ci) => flatten(ci)),
  ];
  const flatItems = items.flatMap((item) => flatten(item));

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
    <>
      <Text px={3} mt={4} as="h3" color="gray.500" mb={2} fontWeight="600">
        Resources
      </Text>
      {tagMatch(items, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route.fullPath} {...item} />
      ))}
    </>
  );
};
