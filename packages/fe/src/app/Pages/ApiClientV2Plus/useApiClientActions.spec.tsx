import 'reflect-metadata';
import '@testing-library/jest-dom';
import { useQuery } from '@tanstack/react-query';
import { useSingleApiClientActions } from './useApiClientActions';
import { ApiClientEntity, useApiClientConfig } from './apiClientConfig';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('react-router', () => ({
  useNavigate: jest.fn(() => jest.fn()),
  useParams: jest.fn(() => ({})),
}));

jest.mock('../../helpers', () => ({
  useAuthorize: jest.fn(() => true),
  useTeamEdfiTenantNavContext: jest.fn(() => ({ sbEnvironmentId: 2, edfiTenantId: 3 })),
  useTeamEdfiTenantNavContextLoaded: jest.fn(() => ({
    edfiTenantId: 3,
    asId: 1,
    teamId: 1,
    edfiTenant: { sbEnvironmentId: 2 },
  })),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers/useSearch', () => ({
  useSearchParamsObject: jest.fn(() => ({})),
}));

// See ViewApiClient.spec.tsx: './apiClientConfig' transitively pulls in the real
// '../../api/queries/queries.v7' chain, which Jest can't parse without extra config.
jest.mock('./apiClientConfig', () => ({
  useApiClientConfig: jest.fn(() => ({
    queries: {
      delete: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
      resetCreds: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
      getAll: jest.fn(() => ({ queryKey: ['apiClients'] })),
    },
  })),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseApiClientConfig = useApiClientConfig as jest.Mock;

const apiClient = { id: 4, name: 'Cred A', applicationId: 7 } as unknown as ApiClientEntity;

/** Drive the hook with a given credential-list query result. */
const actionsFor = (queryResult: object) => {
  mockUseQuery.mockReturnValue(queryResult);
  return useSingleApiClientActions({ apiClient, applicationId: 7 });
};

describe('useSingleApiClientActions — last-credential delete guard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enables Delete when the Application has more than one credential', () => {
    const actions = actionsFor({
      isPending: false,
      isSuccess: true,
      data: { 4: apiClient, 5: { ...apiClient, id: 5 } },
    });
    expect(actions.Delete).toBeDefined();
    expect(actions.Delete.isDisabled).toBe(false);
    expect(actions.Delete.title).toBe('Delete API client credentials');
  });

  it('disables Delete when it is the Application\'s only credential', () => {
    const actions = actionsFor({ isPending: false, isSuccess: true, data: { 4: apiClient } });
    expect(actions.Delete.isDisabled).toBe(true);
  });

  it('explains why in the tooltip when it is the only credential', () => {
    const actions = actionsFor({ isPending: false, isSuccess: true, data: { 4: apiClient } });
    expect(actions.Delete.title).toBe(
      "This is the Application's only credential and can't be deleted. Create another credential first."
    );
  });

  it('disables Delete while the credential count is still loading', () => {
    const actions = actionsFor({ isPending: true, data: undefined });
    expect(actions.Delete.isDisabled).toBe(true);
  });

  // The query builder (packages/fe/src/app/api/queries/builder.ts) defaults
  // `throwOnError` to true. NameCell relies on that, but this hook also backs
  // ApiClientPageActions on the credential detail page, which is not wrapped
  // in an ErrorBoundary — a thrown error there took down the whole page. The
  // hook overrides `throwOnError: false` and must fail closed instead: an
  // errored count is treated the same as "count unknown", keeping Delete
  // blocked rather than defaulting it open.
  it('disables Delete when the credential count query errors', () => {
    const actions = actionsFor({ isPending: false, isError: true, data: undefined });
    expect(actions.Delete.isDisabled).toBe(true);
  });

  // Regression guard: the count is unknown in these states, so claiming this is
  // the only credential would put a false statement on a disabled button.
  it('keeps the tooltip generic when the credential count query errors', () => {
    const actions = actionsFor({ isPending: false, isError: true, data: undefined });
    expect(actions.Delete.title).toBe('Delete API client credentials');
  });

  it('keeps the tooltip generic while the credential count is still loading', () => {
    const actions = actionsFor({ isPending: true, data: undefined });
    expect(actions.Delete.title).toBe('Delete API client credentials');
  });

  // The count query is deliberately built with the same arguments as
  // NameCell's `queries.getAll` call so the query key matches and TanStack
  // Query serves both from one cache entry instead of firing a request per
  // table row. Assert the arguments so a future edit (e.g. swapping `asId`
  // for something else) can't silently reintroduce a per-row request without
  // a test failing. Mirrors the equivalent assertion in ApiClientsPage.spec.tsx.
  it('queries the credential count with the same arguments NameCell uses, so both share one cache entry', () => {
    const getAllSpy = jest.fn(() => ({ queryKey: ['apiClients'] }));
    mockUseApiClientConfig.mockReturnValueOnce({
      queries: {
        delete: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
        resetCreds: jest.fn(() => ({ isPending: false, mutateAsync: jest.fn() })),
        getAll: getAllSpy,
      },
    });

    actionsFor({
      isPending: false,
      isSuccess: true,
      data: { 4: apiClient, 5: { ...apiClient, id: 5 } },
    });

    expect(getAllSpy).toHaveBeenCalledWith(
      { teamId: 1, edfiTenant: { sbEnvironmentId: 2 } },
      { applicationId: 7 }
    );
  });
});
