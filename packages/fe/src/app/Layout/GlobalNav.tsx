import { Box, Link } from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import sortBy from 'lodash/sortBy';
import {
  BsBuildings,
  BsBuildingsFill,
  BsClipboard,
  BsClipboardFill,
  BsHdd,
  BsHddFill,
  BsInboxes,
  BsInboxesFill,
  BsPeople,
  BsPeopleFill,
  BsPersonBadge,
  BsPersonBadgeFill,
  BsPersonVcard,
  BsPersonVcardFill,
  BsPuzzle,
  BsPuzzleFill,
} from 'react-icons/bs';
import { Link as RouterLink, useMatches } from 'react-router-dom';
import { sbEnvironmentQueries } from '../api';
import { arrayElemIf, authorize, useAuthorize, usePrivilegeCacheForConfig } from '../helpers';
import { INavButtonProps, NavButton } from './NavButton';
import { UniversalNavLinks } from './UniversalNavLinks';
import { usePaths } from '../routes/paths';

export const findDeepestMatch = (
  matches: { pathname: string }[],
  flatRoutes: INavButtonProps[]
) => {
  let deepestMatch: string | null = null;

  flatRoutes.forEach((item) => {
    if (
      matches.some(
        (m) =>
          (deepestMatch === null || item.route.length > deepestMatch.length) &&
          m.pathname.startsWith(item.route)
      )
    ) {
      deepestMatch = item.route;
    }
  });
  return deepestMatch;
};

export const isMatch = (deepestMatch: string, item: INavButtonProps) => deepestMatch === item.route;

export const tagMatch = (
  items: INavButtonProps[],
  deepestMatch: string | null
): INavButtonProps[] =>
  deepestMatch === null
    ? items
    : items.map((item) => ({
        ...item,
        isActive: isMatch(deepestMatch, item),
        childItems: tagMatch(item.childItems || [], deepestMatch),
      }));

export const GlobalNav = () => {
  const paths = usePaths({ asTeam: false });
  const queryClient = useQueryClient();
  const sbEnvironmentsIsAuthorized = useAuthorize({
    privilege: 'sb-environment:read',
    subject: {
      id: '__filtered__',
    },
  });
  const sbEnvironments = useQuery({
    ...sbEnvironmentQueries.getAll({}),
    enabled: sbEnvironmentsIsAuthorized,
  });

  usePrivilegeCacheForConfig([
    {
      privilege: 'ownership:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'team:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'role:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'user:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'user-team-membership:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'sb-environment.edfi-tenant:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'sb-sync-queue:read',
      subject: {
        id: '__filtered__',
      },
    },
  ]);
  const globalItems: INavButtonProps[] = [
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'sb-environment:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/sb-environments`,
        icon: BsHdd,
        activeIcon: BsHddFill,
        text: 'Environments',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'team:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/teams`,
        icon: BsBuildings,
        activeIcon: BsBuildingsFill,
        text: 'Teams',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'user:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/users`,
        icon: BsPeople,
        activeIcon: BsPeopleFill,
        text: 'Users',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'user-team-membership:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/user-team-memberships`,
        icon: BsPersonBadge,
        activeIcon: BsPersonBadgeFill,
        text: 'Team memberships',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'role:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/roles`,
        icon: BsPersonVcard,
        activeIcon: BsPersonVcardFill,
        text: 'Roles',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'ownership:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/ownerships`,
        icon: BsClipboard,
        activeIcon: BsClipboardFill,
        text: 'Ownerships',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'integration-provider:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: paths.integrationProvider.index(),
        icon: BsPuzzle,
        activeIcon: BsPuzzleFill,
        text: 'Integration Providers',
      }
    ),
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'sb-sync-queue:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/sb-sync-queues`,
        icon: BsInboxes,
        activeIcon: BsInboxesFill,
        text: 'Sync queue',
      }
    ),
  ];

  const environmentItems = sortBy(Object.values(sbEnvironments.data || {}), (sbEnvironment) =>
    sbEnvironment.displayName.toLocaleLowerCase()
  )
    .map((sbEnvironment) =>
      arrayElemIf(
        authorize({
          queryClient,
          config: {
            privilege: 'sb-environment:read',
            subject: { id: sbEnvironment.id },
          },
        }),
        {
          route: `/sb-environments/${sbEnvironment.id}`,
          icon: BsHdd,
          activeIcon: BsHddFill,
          text: sbEnvironment.displayName,
        }
      )
    )
    .flat();

  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap(flatten),
  ];
  const flatItems = [...globalItems, ...environmentItems].flatMap(flatten);

  const deepestMatch: string | null = findDeepestMatch(useMatches(), flatItems);

  return (
    <Box overflowY="auto" flex="1 1 0%">
      <UniversalNavLinks />
      {tagMatch(globalItems, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route} {...item} />
      ))}
      {environmentItems.length ? (
        <>
          <Link
            to="/sb-environments"
            as={RouterLink}
            display={'block'}
            px={3}
            mt={4}
            mb={2}
            color="gray.600"
            fontWeight="600"
          >
            Environments
          </Link>
          {tagMatch(environmentItems, deepestMatch).map((item) => (
            <NavButton key={item.text + item.route} {...item} />
          ))}
        </>
      ) : null}
    </Box>
  );
};
