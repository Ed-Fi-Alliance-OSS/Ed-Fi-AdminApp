import 'reflect-metadata';

// builder.ts imports the ESM-only 'kebab-case' package that Jest's Babel transform can't parse
// (same reason claimsetQueriesV3.spec.ts mocks it).
jest.mock('kebab-case', () => (str: string) => str);

// Hand back the raw mutation config so its onSuccess can be called directly, with one shared
// invalidateQueries spy standing in for the QueryClient.
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: unknown) => config),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

// Avoids methods.ts -> config/config.ts's `import.meta.env`, which Jest can't parse.
jest.mock('../methods', () => ({
  apiClient: {},
  methods: {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    getOne: jest.fn(),
    getManyMap: jest.fn(),
  },
}));

// queries.ts only needs authCacheKey from helpers; the real module pulls in react-router (ESM).
jest.mock('../../helpers', () => ({ authCacheKey: jest.fn(() => ['auth-cache']) }));

import {
  ownershipQueries,
  roleQueries,
  teamQueries,
  userQueries,
  userTeamMembershipQueries,
} from './queries';

type MutationConfig = { onSuccess: (data: unknown, variables: unknown) => void };

// The team context picker reads ['me', 'teams'] (useMyTeams). Creating, editing or deleting a
// team or a membership changes that list, so the picker must refetch instead of showing a stale
// list until a reload.
describe('team and membership mutations refresh the team context picker', () => {
  afterEach(() => jest.clearAllMocks());

  const cases: Array<[string, () => MutationConfig, unknown]> = [
    [
      'team post',
      () => teamQueries.post({}) as unknown as MutationConfig,
      { entity: { name: 't' } },
    ],
    [
      'team put',
      () => teamQueries.put({}) as unknown as MutationConfig,
      { entity: { id: 1, name: 't' } },
    ],
    ['team delete', () => teamQueries.delete({}) as unknown as MutationConfig, { id: 1 }],
    [
      'membership post',
      () => userTeamMembershipQueries.post({}) as unknown as MutationConfig,
      { entity: { teamId: 1, userId: 1 } },
    ],
    [
      'membership put',
      () => userTeamMembershipQueries.put({}) as unknown as MutationConfig,
      { entity: { id: 1, teamId: 1, userId: 1 } },
    ],
    [
      'membership delete',
      () => userTeamMembershipQueries.delete({}) as unknown as MutationConfig,
      { id: 1 },
    ],
  ];

  it.each(cases)('%s invalidates the my-teams query', (_name, makeMutation, variables) => {
    makeMutation().onSuccess({ id: 1 }, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['me', 'teams'] });
  });
});

// The menu (certification, vendors, ODSs...) is driven by the session (['me']), the privilege
// cache (['auth-cache']) and each team's env-nav list. Anything that changes what a user may do
// must refresh all three, or an already-signed-in user keeps the old menu until the caches expire.
describe('permission-changing mutations refresh the menu state', () => {
  afterEach(() => jest.clearAllMocks());

  const cases: Array<[string, () => MutationConfig, unknown]> = [
    [
      'membership post',
      () => userTeamMembershipQueries.post({}) as unknown as MutationConfig,
      { entity: { teamId: 1, userId: 1 } },
    ],
    [
      'membership put',
      () => userTeamMembershipQueries.put({}) as unknown as MutationConfig,
      { entity: { id: 1, teamId: 1, userId: 1 } },
    ],
    [
      'membership delete',
      () => userTeamMembershipQueries.delete({}) as unknown as MutationConfig,
      { id: 1 },
    ],
    ['user put', () => userQueries.put({}) as unknown as MutationConfig, { entity: { id: 1 } }],
    ['role put', () => roleQueries.put({}) as unknown as MutationConfig, { entity: { id: 1 } }],
    ['role delete', () => roleQueries.delete({}) as unknown as MutationConfig, { id: 1 }],
    [
      'ownership post',
      () => ownershipQueries.post({}) as unknown as MutationConfig,
      { entity: { teamId: 1 } },
    ],
    [
      'ownership put',
      () => ownershipQueries.put({}) as unknown as MutationConfig,
      { entity: { id: 1, teamId: 1 } },
    ],
    ['ownership delete', () => ownershipQueries.delete({}) as unknown as MutationConfig, { id: 1 }],
  ];

  it.each(cases)('%s invalidates me, auth-cache and env-nav', (_name, makeMutation, variables) => {
    makeMutation().onSuccess({ id: 1 }, variables);

    const calls = mockInvalidateQueries.mock.calls.map(([filter]) => filter);
    expect(calls).toContainEqual({ queryKey: ['me'] });
    expect(calls).toContainEqual({ queryKey: ['auth-cache'] });

    const predicate = calls.find((f) => typeof f?.predicate === 'function')?.predicate;
    expect(predicate).toBeDefined();
    expect(predicate({ queryKey: ['/teams/7/env-nav'] })).toBe(true);
    expect(predicate({ queryKey: ['users', 'list'] })).toBe(false);
  });
});
