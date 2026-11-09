import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamQueries } from '../../api';
import { AuthorizeConfig, authorize, usePrivilegeCacheForConfig } from '../../helpers';

/**
 * Whether the user holds certification:read on at least one of the team's data stores.
 * Single source of truth for the team Certification menu and the My products page guard.
 *
 * The API flags each tenant row of the team's env-nav list (`certifications`), so this costs one
 * request however many tenants the team has, instead of one privilege-cache request per tenant.
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

  return {
    canSee: Object.values(navList.data ?? {}).some((item) => item.certifications),
    isLoading: sbEnvCache.some((cache) => cache.isLoading) || navList.isLoading,
  };
};
