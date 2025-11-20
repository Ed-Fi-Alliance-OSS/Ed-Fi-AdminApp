import { useNavContext } from '../helpers';

type Id = string | number;

const pathPartials = {
  asTeam: 'as/:asId',
  create: 'create',
  edit: 'edit=true',
  integrationApp: {
    index: 'integration-apps',
    id: 'integration-apps/:integrationAppId',
  },
  integrationProvider: {
    index: 'integration-providers',
    id: 'integration-providers/:integrationProviderId',
  },
};

const globalPaths = {
  integrationProvider: {
    index: `/${pathPartials.integrationProvider.index}`,
    create: `/${pathPartials.integrationProvider.index}/${pathPartials.create}`,
    view: `/${pathPartials.integrationProvider.id}`,
    edit: `/${pathPartials.integrationProvider.id}?${pathPartials.edit}`,
  },
};

const asTeamPaths = {
  integrationApp: {
    view: `/${pathPartials.asTeam}/${pathPartials.integrationProvider.id}/${pathPartials.integrationApp.id}`,
  },
  integrationProvider: {
    index: `/${pathPartials.asTeam}/${pathPartials.integrationProvider.index}`,
    create: `/${pathPartials.asTeam}/${pathPartials.integrationProvider.index}/${pathPartials.create}`,
    view: `/${pathPartials.asTeam}/${pathPartials.integrationProvider.id}`,
    edit: `/${pathPartials.asTeam}/${pathPartials.integrationProvider.id}?${pathPartials.edit}`,
  },
};

/**
 * This object is meant to be used to provide static paths for route definitions.
 * For route definitions, use either:
 *   - paths.[resourceName].[pathName] to get the route definition without a team
 *   - paths.asTeam.[resourceName].[pathName] to get the route definition for a team
 */
export const routeDefinitions = {
  ...globalPaths,
  asTeam: asTeamPaths,
};

function replaceKeyIds(path: string, ids: Record<string, Id>) {
  return Object.entries(ids).reduce((acc, [key, value]) => {
    return acc.replace(`:${key}`, `${value}`);
  }, path);
}

const dynamicGlobalPaths = {
  integrationProvider: {
    index: () => globalPaths.integrationProvider.index,
    create: () => globalPaths.integrationProvider.create,
    view: (ids: { integrationProviderId: Id }) =>
      replaceKeyIds(globalPaths.integrationProvider.view, ids),
    edit: (ids: { integrationProviderId: Id }) =>
      replaceKeyIds(globalPaths.integrationProvider.edit, ids),
  },
  integrationApp: {
    // dummy function for TypeScript satisfaction
    view: (_: { integrationProviderId: Id; integrationAppId: Id }) => '',
  },
};

const dynamicTeamPaths = (asId: Id = 'no-team-given') => ({
  integrationProvider: {
    index: () => replaceKeyIds(asTeamPaths.integrationProvider.index, { asId }),
    create: () => replaceKeyIds(asTeamPaths.integrationProvider.create, { asId }),
    view: (ids: { integrationProviderId: Id }) =>
      replaceKeyIds(asTeamPaths.integrationProvider.view, { asId, ...ids }),
    edit: (ids: { integrationProviderId: Id }) =>
      replaceKeyIds(asTeamPaths.integrationProvider.edit, { asId, ...ids }),
  },
  integrationApp: {
    view: (ids: { integrationProviderId: Id; integrationAppId: Id }) =>
      replaceKeyIds(asTeamPaths.integrationApp.view, { asId, ...ids }),
  },
});

/**
 * A hook to get various paths for the app.
 * Use the asTeam parameter to explicity get paths for a team or not.
 * If no asTeam parameter is provided, the paths will be automatically determined if a team is set.
 *
 * Usage:
 *  const paths = usePaths();
 *  const paths = usePaths({ asTeam: true });
 *  const paths = usePaths({ asTeam: false });
 *
 * @param param0.asTeam a boolean to determine if the path should be for a team
 * @returns a record of paths
 */
export const usePaths = ({ asTeam }: { asTeam: boolean } = { asTeam: true }) => {
  const navContext = useNavContext();
  const { asId: teamId } = navContext;

  if (asTeam && teamId) {
    return dynamicTeamPaths(teamId);
  }

  return dynamicGlobalPaths;
};
