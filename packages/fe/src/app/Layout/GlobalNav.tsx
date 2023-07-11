import { Text } from '@chakra-ui/react';
import {
  BsBuildings,
  BsBuildingsFill,
  BsClipboard,
  BsClipboardFill,
  BsFolder,
  BsFolderFill,
  BsPersonVcard,
  BsPersonVcardFill,
} from 'react-icons/bs';
import { useMatches } from 'react-router-dom';
import { sbeQueries } from '../api/queries/queries';
import { INavButtonProps, NavButton } from './NavButton';
import { queryClient } from '../app';
import { usePrivilegeCacheForConfig, arrayElemIf, authorize } from '../helpers';
import { useQueryClient } from '@tanstack/react-query';

export const isMatch = (activeRoute: string, item: INavButtonProps) => {
  const paramsEqual = activeRoute.startsWith(item.route);
  const sameRoute = item.route === activeRoute;

  return sameRoute && paramsEqual;
};

export const tagMatch = (items: INavButtonProps[], match: string | null): INavButtonProps[] =>
  match === null
    ? items
    : items.map((item) => ({
        ...item,
        isActive: isMatch(match, item),
        childItems: tagMatch(item.childItems || [], match),
      }));

export const GlobalNav = (props: object) => {
  const sbes = sbeQueries.useAll({});
  const queryClient = useQueryClient();

  usePrivilegeCacheForConfig([
    {
      privilege: 'ownership:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'tenant:read',
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
      privilege: 'sbe:read',
      subject: {
        id: '__filtered__',
      },
    },
  ]);
  const items: INavButtonProps[] = [
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'tenant:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/tenants`,
        icon: BsBuildings,
        activeIcon: BsBuildingsFill,
        text: 'Tenants',
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
          privilege: 'sbe:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/sbes`,
        icon: BsFolder,
        activeIcon: BsFolderFill,
        text: 'Environments',
        childItems: Object.values(sbes.data || {})
          .map((sbe) =>
            arrayElemIf(
              authorize({
                queryClient,
                config: {
                  privilege: 'sbe:read',
                  subject: { id: sbe.id },
                },
              }),
              {
                route: `/sbes/${sbe.id}`,
                icon: BsFolder,
                activeIcon: BsFolderFill,
                text: sbe.displayName,
              }
            )
          )
          .flat(),
      }
    ),
  ];

  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap((ci) => flatten(ci)),
  ];
  const flatItems = items.flatMap((item) => flatten(item));

  let deepestMatch = null;
  const currentMatches = useMatches();

  currentMatches.forEach((m) => {
    if (flatItems.some((item) => isMatch(m.pathname, item))) {
      deepestMatch = m.pathname;
    }
  });

  return (
    <>
      <Text px={3} mt={4} as="h3" color="gray.500" mb={2} fontWeight="600">
        Resources
      </Text>
      {tagMatch(items, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route} {...item} />
      ))}
    </>
  );
};
