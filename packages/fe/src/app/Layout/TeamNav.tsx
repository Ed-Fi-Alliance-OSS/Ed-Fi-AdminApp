import { Box, IconButton, Text } from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import set from 'lodash/set';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import { useEffect, useMemo, useState } from 'react';
import {
  BsBuilding,
  BsBuildingFill,
  BsDatabase,
  BsDatabaseFill,
  BsFileEarmarkDiff,
  BsFileEarmarkDiffFill,
  BsFillMortarboardFill,
  BsGrid,
  BsGridFill,
  BsHdd,
  BsHddFill,
  BsKey,
  BsKeyFill,
  BsMortarboard,
  BsPeople,
  BsPeopleFill,
  BsPin,
  BsPinFill,
  BsPuzzle,
  BsPuzzleFill,
  BsShieldLock,
  BsShieldLockFill,
} from 'react-icons/bs';
import { useMatches, useParams } from 'react-router-dom';
import { sbEnvironmentQueries, teamQueries } from '../api';
import {
  AuthorizeConfig,
  arrayElemIf,
  authorize,
  useAuthorize,
  usePrivilegeCacheForConfig,
} from '../helpers';
import { EnvironmentsNav } from './EnvironmentsNav';
import { findDeepestMatch, tagMatch } from './GlobalNav';
import { INavButtonProps, NavButton } from './NavButton';
import { UniversalNavLinks } from './UniversalNavLinks';

type OpenNavs = Record<number, number[]>;
const mergeOpenNavs = (objectOne: OpenNavs, objectTwo: OpenNavs) => {
  const result: OpenNavs = {};
  for (const key in objectOne) {
    result[key] = objectOne[key];
  }
  for (const key in objectTwo) {
    if (result[key]) {
      result[key] = uniq(result[key].concat(objectTwo[key]));
    } else {
      result[key] = objectTwo[key];
    }
  }
  return result;
};
const navPinAtom = atomWithStorage<Record<string, OpenNavs>>('navPin', {});
const addPinnedTenant = (
  pinnedTenants: Record<string, OpenNavs>,
  teamId: string | number,
  sbEnvironmentId: string | number,
  edfiTenantId: number
) => {
  const teamIdStr = String(teamId);
  const sbEnvironmentIdStr = String(sbEnvironmentId);
  return {
    ...pinnedTenants,
    [teamIdStr]: {
      ...pinnedTenants[teamIdStr],
      [sbEnvironmentIdStr]: [
        ...(pinnedTenants[teamIdStr]?.[Number(sbEnvironmentIdStr)] || []).filter(
          (id) => id !== edfiTenantId
        ),
        edfiTenantId,
      ],
    },
  };
};
const removePinnedTenant = (
  pinnedTenants: Record<string, OpenNavs>,
  teamId: string | number,
  sbEnvironmentId: string | number,
  edfiTenantId: number
) => {
  const teamIdStr = String(teamId);
  const sbEnvironmentIdStr = String(sbEnvironmentId);
  return {
    ...pinnedTenants,
    [teamIdStr]: {
      ...pinnedTenants[teamIdStr],
      [sbEnvironmentIdStr]: (pinnedTenants[teamIdStr][Number(sbEnvironmentIdStr)] || []).filter(
        (id) => id !== edfiTenantId
      ),
    },
  };
};

export const TeamNav = (props: { teamId: string }) => {
  const { edfiTenantId, sbEnvironmentId } = useParams();
  const [lastTenantFromNav, setLastTenantFromNav] = useState(
    edfiTenantId ? { [sbEnvironmentId!]: [Number(edfiTenantId)] } : {}
  );
  useEffect(() => {
    edfiTenantId && setLastTenantFromNav({ [sbEnvironmentId!]: [Number(edfiTenantId)] });
  }, [edfiTenantId, sbEnvironmentId]);
  useEffect(() => {
    setLastTenantFromNav({});
  }, [props.teamId]);

  const tenantFromNav = edfiTenantId
    ? { [sbEnvironmentId!]: [Number(edfiTenantId)] }
    : lastTenantFromNav;

  const [pinnedTenants, setPinnedTenants] = useAtom(navPinAtom);

  const openNavItems = mergeOpenNavs(tenantFromNav, pinnedTenants[props.teamId] ?? {});

  const teamId = Number(props.teamId);
  const queryClient = useQueryClient();
  const sbEnvironmentAuth: AuthorizeConfig = {
    privilege: 'team.sb-environment:read',
    subject: {
      id: '__filtered__',
      teamId,
    },
  };
  const sbEnvironments = useQuery({
    ...sbEnvironmentQueries.getAll({ teamId }),
    enabled: useAuthorize(sbEnvironmentAuth),
  });

  usePrivilegeCacheForConfig([
    sbEnvironmentAuth,
    {
      privilege: 'team.role:read',
      subject: {
        id: '__filtered__',
        teamId: teamId,
      },
    },
    {
      privilege: 'team.user:read',
      subject: {
        id: '__filtered__',
        teamId: teamId,
      },
    },
    {
      privilege: 'team.ownership:read',
      subject: {
        id: '__filtered__',
        teamId: teamId,
      },
    },
    ...Object.entries(openNavItems).flatMap(([sbEnvironmentId, edfiTenantIds]) =>
      edfiTenantIds.flatMap((edfiTenantId) => [
        {
          privilege: 'team.sb-environment.edfi-tenant:read' as const,
          subject: {
            id: edfiTenantId,
            sbEnvironmentId: Number(sbEnvironmentId),
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.claimset:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.profile:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.vendor:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
        {
          privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read' as const,
          subject: {
            id: '__filtered__',
            edfiTenantId: edfiTenantId,
            teamId: teamId,
          },
        },
      ])
    ),
  ]);

  const envNavList = useQuery(
    teamQueries.navSearchList(
      {
        enabled: useAuthorize(sbEnvironmentAuth),
      },
      { teamId }
    )
  );

  const envNavTenantNams = useMemo(() => {
    const items: Record<number, Record<number, string>> = {};
    Object.entries(envNavList.data || {}).forEach(([key, value]) => {
      set(items, `${value.sbEnvironmentId}.${value.edfiTenantId}`, value.edfiTenantName);
    });
    return items;
  }, [envNavList.data]);

  const sbEnvironmentItems = sortBy(Object.values(sbEnvironments.data || {}), (sbEnvironment) =>
    sbEnvironment.displayName.toLocaleLowerCase()
  )
    .map((sbEnvironment) => {
      return arrayElemIf(
        authorize({
          queryClient,
          config: {
            privilege: 'team.sb-environment:read',
            subject: { id: sbEnvironment.id, teamId },
          },
        }),
        {
          route: `/as/${teamId}/sb-environments/${sbEnvironment.id}`,
          icon: BsHdd,
          activeIcon: BsHddFill,
          text: sbEnvironment.displayName,
          childItems:
            sbEnvironment.id in openNavItems && sbEnvironment.id in envNavTenantNams
              ? openNavItems[sbEnvironment.id]
                  .reduce((accum, edfiTenantId) => {
                    const loadedEdfiTenantName = envNavTenantNams[sbEnvironment.id][edfiTenantId];

                    if (loadedEdfiTenantName === undefined) {
                      return accum;
                    }
                    const isPinned =
                      pinnedTenants[props.teamId]?.[sbEnvironment.id]?.includes(edfiTenantId);
                    const tenantRootUrl = `/as/${props.teamId}/sb-environments/${sbEnvironment.id}/edfi-tenants/${edfiTenantId}`;
                    const privilegeSubject = {
                      teamId,
                      edfiTenantId,
                      id: '__filtered__',
                    };

                    accum.push({
                      route: `/as/${teamId}/sb-environments/${sbEnvironment.id}/edfi-tenants/${edfiTenantId}`,
                      text: loadedEdfiTenantName,
                      rightElement: (
                        <IconButton
                          onClick={
                            isPinned
                              ? () =>
                                  setPinnedTenants(
                                    removePinnedTenant(
                                      pinnedTenants,
                                      teamId,
                                      sbEnvironment.id,
                                      edfiTenantId
                                    )
                                  )
                              : () =>
                                  setPinnedTenants(
                                    addPinnedTenant(
                                      pinnedTenants,
                                      teamId,
                                      sbEnvironment.id,
                                      edfiTenantId
                                    )
                                  )
                          }
                          pos="absolute"
                          aria-label="pin"
                          title="pin"
                          variant="unstyled"
                          w="20px"
                          h="20px"
                          minH="20px"
                          minW="20px"
                          size="sm"
                          transform="translateX(-150%)"
                          _hover={{
                            bg: 'gray.200',
                          }}
                          css={{
                            svg: {
                              margin: 'auto',
                            },
                          }}
                          icon={isPinned ? <BsPinFill /> : <BsPin />}
                        />
                      ),
                      icon: BsGrid,
                      activeIcon: BsGridFill,
                      childItems: [
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.ods:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/odss`,
                            icon: BsDatabase,
                            activeIcon: BsDatabaseFill,
                            text: 'ODSs',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.ods.edorg:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/edorgs`,
                            icon: BsMortarboard,
                            activeIcon: BsFillMortarboardFill,
                            text: 'Ed-Orgs',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.vendor:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/vendors`,
                            icon: BsBuilding,
                            activeIcon: BsBuildingFill,
                            text: 'Vendors',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege:
                                'team.sb-environment.edfi-tenant.ods.edorg.application:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/applications`,
                            icon: BsKey,
                            activeIcon: BsKeyFill,
                            text: 'Applications',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.claimset:read',
                              subject: privilegeSubject,
                            },
                          }),
                          {
                            route: `${tenantRootUrl}/claimsets`,
                            icon: BsShieldLock,
                            activeIcon: BsShieldLockFill,
                            text: 'Claimsets',
                          }
                        ),
                        ...arrayElemIf(
                          authorize({
                            queryClient,
                            config: {
                              privilege: 'team.sb-environment.edfi-tenant.profile:read',
                              subject: privilegeSubject,
                            },
                          }) && sbEnvironment?.version === 'v2',
                          {
                            route: `${tenantRootUrl}/profiles`,
                            icon: BsFileEarmarkDiff,
                            activeIcon: BsFileEarmarkDiffFill,
                            text: 'Profiles',
                          }
                        ),
                        ...arrayElemIf(
                          // TODO: remove false in the next PR
                          false &&
                            authorize({
                              queryClient,
                              config: {
                                privilege: 'team.integration-provider.application:read',
                                subject: {
                                  id: '__filtered__',
                                  // teamId,
                                },
                              },
                            }),
                          {
                            route: `${tenantRootUrl}/integration-providers`,
                            icon: BsPuzzle,
                            activeIcon: BsPuzzleFill,
                            text: 'Integration Providers',
                          }
                        ),
                      ],
                    });
                    return accum;
                  }, [] as INavButtonProps[])
                  .sort((a, b) => a.text.localeCompare(b.text))
              : undefined,
        }
      );
    })
    .flat();

  const mainItems: INavButtonProps[] = [
    ...arrayElemIf(
      authorize({
        queryClient,
        config: {
          privilege: 'team.user:read',
          subject: { teamId, id: '__filtered__' },
        },
      }),
      {
        route: `/as/${props.teamId}/users`,
        icon: BsPeople,
        activeIcon: BsPeopleFill,
        text: 'Users',
      }
    ),
  ];

  const flatten = (item: INavButtonProps): INavButtonProps[] => [
    item,
    ...(item.childItems ?? []).flatMap((ci) => flatten(ci)),
  ];
  const allItemsFlat = [...mainItems, ...sbEnvironmentItems].flatMap((item) => flatten(item));

  const deepestMatch: string | null = findDeepestMatch(useMatches(), allItemsFlat);

  return (
    <>
      <UniversalNavLinks />
      {tagMatch(mainItems, deepestMatch).map((item) => (
        <NavButton key={item.text + item.route} {...item} />
      ))}
      {sbEnvironmentItems.length ? (
        <>
          <Text px={3} mt={4} as="h3" color="gray.600" mb={2} fontWeight="600">
            Environments
          </Text>
          <EnvironmentsNav />
          <Box flexShrink={1} flexGrow={1} flexBasis="0%" overflowY="auto">
            {tagMatch(sbEnvironmentItems, deepestMatch).map((item) => (
              <NavButton key={item.text + item.route} {...item} />
            ))}
          </Box>
        </>
      ) : null}
    </>
  );
};
