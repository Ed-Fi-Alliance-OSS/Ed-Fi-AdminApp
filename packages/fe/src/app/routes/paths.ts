import { useNavContext } from '../helpers';

type Id = string | number;

const pathPartials = {
  asTeam: 'as/:asId',
  certification: {
    dashboard: 'certification/dashboard',
    run: 'certification/runs/:runId',
    review: 'certification/runs/:runId/review',
    reviewSteps: 'certification/runs/:runId/review/steps',
    runExecution: 'certification/runs/:runId/execution',
    runHistory: 'certification/run-history',
  },
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
  myProducts: {
    index: 'my-products',
  },
};

const globalPaths = {
  certificationDashboard: {
    index: `/${pathPartials.certification.dashboard}`,
  },
  certificationReview: {
    index: `/${pathPartials.certification.review}`,
  },
  certificationReviewSteps: {
    index: `/${pathPartials.certification.reviewSteps}`,
  },
  integrationProvider: {
    index: `/${pathPartials.integrationProvider.index}`,
    create: `/${pathPartials.integrationProvider.index}/${pathPartials.create}`,
    view: `/${pathPartials.integrationProvider.id}`,
    edit: `/${pathPartials.integrationProvider.id}?${pathPartials.edit}`,
  },
};

const asTeamPaths = {
  myProducts: {
    index: `/${pathPartials.asTeam}/${pathPartials.myProducts.index}`,
  },
  certification: {
    run: `/${pathPartials.asTeam}/${pathPartials.certification.run}`,
    runExecution: `/${pathPartials.asTeam}/${pathPartials.certification.runExecution}`,
    runHistory: `/${pathPartials.asTeam}/${pathPartials.certification.runHistory}`,
  },
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

/** The team's My products page. */
export const myProductsPath = (asId: Id) => replaceKeyIds(asTeamPaths.myProducts.index, { asId });

/** The Scenarios page of one certification run. Team-only: a run always belongs to a team. */
export const certificationRunPath = (asId: Id, runId: Id) =>
  replaceKeyIds(asTeamPaths.certification.run, { asId, runId });

/** The steps page of one certification run; the scenario goes in the query string. */
export const certificationRunExecutionPath = (asId: Id, runId: Id) =>
  replaceKeyIds(asTeamPaths.certification.runExecution, { asId, runId });

/** The review pages' query string; `domain` is the scenarios page's filter, carried to and from the steps page. */
const reviewQuery = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
    .toString()
    .replace(/\+/g, '%20');
  return query ? `?${query}` : '';
};

/** The global admin's review page of one certification run, filtered to `domain` when given. */
export const certificationReviewPath = (runId: Id, domain?: string) =>
  `${replaceKeyIds(globalPaths.certificationReview.index, { runId })}${reviewQuery({ domain })}`;

/**
 * The global admin's steps page of one scenario of a run; the scenario goes in the query string,
 * with the scenarios page's domain filter so Back returns to it.
 */
export const certificationReviewStepsPath = (runId: Id, scenarioId: Id, domain?: string) =>
  `${replaceKeyIds(globalPaths.certificationReviewSteps.index, { runId })}${reviewQuery({
    scenarioId: String(scenarioId),
    domain,
  })}`;

const dynamicGlobalPaths = {
  certificationDashboard: {
    index: () => globalPaths.certificationDashboard.index,
  },
  certificationReview: {
    index: (ids: { runId: Id }) => certificationReviewPath(ids.runId),
  },
  certificationReviewSteps: {
    index: (ids: { runId: Id; scenarioId: Id }) =>
      certificationReviewStepsPath(ids.runId, ids.scenarioId),
  },
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
  myProducts: {
    // team-only page; dummy function for TypeScript satisfaction
    index: () => '',
  },
  runHistory: {
    index: () => '',
  },
};

const dynamicTeamPaths = (asId: Id = 'no-team-given') => ({
  certificationDashboard: {
    // global-only page; dummy function for TypeScript satisfaction
    index: () => '',
  },
  certificationReview: {
    // global-only page; dummy function for TypeScript satisfaction
    index: (_: { runId: Id }) => '',
  },
  certificationReviewSteps: {
    // global-only page; dummy function for TypeScript satisfaction
    index: (_: { runId: Id; scenarioId: Id }) => '',
  },
  myProducts: {
    index: () => replaceKeyIds(asTeamPaths.myProducts.index, { asId }),
  },
  runHistory: {
    index: () => replaceKeyIds(asTeamPaths.certification.runHistory, { asId }),
  },
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
