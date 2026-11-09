import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { teamQueries } from '../../api';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';

/**
 * Whether the user holds certification:read on at least one of the team's data stores.
 * Single source of truth for the team Certification menu and the My products page guard.
 */
export const useCanSeeCertification = (teamId: number): { canSee: boolean; isLoading: boolean } => {
  const queryClient = useQueryClient();
  const sbEnvironmentAuth: AuthorizeConfig = {
    privilege: 'team.sb-environment:read',
    subject: { id: '__filtered__', teamId },
  };
  // Track the team cache's loading state: until it arrives, authorize() is false and the nav
  // query is disabled (isLoading false in TanStack v5), which would read as "not allowed".
  const sbEnvCache = usePrivilegeCacheForConfig(sbEnvironmentAuth);
  const canReadEnvs = authorize({ queryClient, config: sbEnvironmentAuth });
  const navList = useQuery(teamQueries.navSearchList({ enabled: canReadEnvs }, { teamId }));

  const configs = useMemo(() => {
    const tenantIds = Array.from(
      new Set(
        Object.values(navList.data ?? {})
          .map((item) => item.edfiTenantId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    return tenantIds.map((edfiTenantId): AuthorizeConfig => ({
      privilege: 'team.sb-environment.edfi-tenant.ods.certification:read',
      subject: { id: '__filtered__', edfiTenantId, teamId },
    }));
  }, [navList.data, teamId]);

  const caches = usePrivilegeCacheForConfig(configs);

  return {
    canSee: configs.some((config) => authorize({ queryClient, config })),
    isLoading:
      sbEnvCache.some((cache) => cache.isLoading) ||
      navList.isLoading ||
      caches.some((cache) => cache.isLoading),
  };
};
