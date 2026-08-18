import { useQuery } from '@tanstack/react-query';
import { sbEnvironmentQueries } from '../api';

/**
 * This deployment is assumed to have a single relevant SbEnvironment, so its
 * `startingBlocks` flag stands in for whether the whole deployment is a
 * Starting Blocks deployment (as opposed to a generic Ed-Fi Data Store one).
 *
 * Defaults to `false` while environments are loading or if none exist yet.
 */
export const useIsStartingBlocksDeployment = () => {
  const sbEnvironments = useQuery(sbEnvironmentQueries.getAll({}));
  const [firstEnvironment] = Object.values(sbEnvironments.data ?? {});
  return firstEnvironment?.startingBlocks ?? false;
};
