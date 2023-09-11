import { useQueryClient } from '@tanstack/react-query';
import sortBy from 'lodash/sortBy';
import {
  BsBuildings,
  BsBuildingsFill,
  BsClipboard,
  BsClipboardFill,
  BsFolder,
  BsFolderFill,
  BsInboxes,
  BsInboxesFill,
  BsPeople,
  BsPeopleFill,
  BsPersonBadge,
  BsPersonBadgeFill,
  BsPersonVcard,
  BsPersonVcardFill,
} from 'react-icons/bs';
import { useMatches } from 'react-router-dom';
import { sbeQueries } from '../api';
import { arrayElemIf, authorize, usePrivilegeCacheForConfig } from '../helpers';
import { INavButtonProps, NavButton } from './NavButton';

export const isMatch = (activeRoute: string, item: INavButtonProps) => {
  const nextChar = activeRoute.charAt(item.route.length);
  return activeRoute.startsWith(item.route) && (nextChar === '/' || nextChar === '');
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
  const queryClient = useQueryClient();
  const sbes = sbeQueries.useAll({ optional: true });

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
      privilege: 'user:read',
      subject: {
        id: '__filtered__',
      },
    },
    {
      privilege: 'user-tenant-membership:read',
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
    {
      privilege: 'sb-sync-queue:read',
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
          privilege: 'user-tenant-membership:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/user-tenant-memberships`,
        icon: BsPersonBadge,
        activeIcon: BsPersonBadgeFill,
        text: 'Tenant Memberships',
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
          privilege: 'sb-sync-queue:read',
          subject: { id: '__filtered__' },
        },
      }),
      {
        route: `/sb-sync-queues`,
        icon: BsInboxes,
        activeIcon: BsInboxesFill,
        text: 'SB Sync Queue',
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
        childItems: sortBy(Object.values(sbes.data || {}), (sbe) =>
          sbe.displayName.toLocaleLowerCase()
        )
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

  let deepestMatch: string | null = null;
  const currentMatches = useMatches();

  currentMatches.forEach((m) => {
    if (
      flatItems.some((item) => isMatch(m.pathname, item)) &&
      m.pathname.length > (deepestMatch ?? '').length
    ) {
      deepestMatch = m.pathname;
    }
  });

  return items.length ? (
    <>
      {tagMatch(items, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route} {...item} />
      ))}
    </>
  ) : null;
};
