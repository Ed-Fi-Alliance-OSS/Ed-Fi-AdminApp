import 'reflect-metadata';
import { useSyncEdOrgsAction } from './useSyncEdOrgsAction';
import { ActionsType, ActionProps } from '@edanalytics/common-ui';

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  useAuthorize: jest.fn(),
  teamEdfiTenantAuthConfig: jest.fn((id, edfiTenantId, teamId, privilege) => ({
    privilege,
    subject: { id, edfiTenantId, teamId },
  })),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(),
}));

jest.mock('../../api', () => ({
  edorgQueries: {
    syncEdOrgs: jest.fn(),
  },
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

import { useTeamEdfiTenantNavContextLoaded, useAuthorize } from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { edorgQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;
const mockUsePopBanner = usePopBanner as jest.Mock;
const mockSyncEdOrgsQuery = edorgQueries.syncEdOrgs as jest.Mock;

const buildSbEnvironment = (version: 'v1' | 'v2' | 'startingBlocks' | undefined, startingBlocks = false) => ({
  id: 1,
  version,
  configPublic: version ? { version, startingBlocks } : undefined,
  startingBlocks,
});

const buildEdfiTenant = () => ({ id: 10, sbEnvironment: buildSbEnvironment('v2') });

const buildMutation = (overrides: object = {}) => ({
  isPending: false,
  mutateAsync: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const setupMocks = (version: 'v1' | 'v2' | 'startingBlocks' | undefined, canSyncEdOrgs = true, startingBlocks = false) => {
  mockUsePopBanner.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenant: buildEdfiTenant(),
    sbEnvironment: buildSbEnvironment(version, startingBlocks),
    teamId: 1,
  });
  mockUseAuthorize.mockReturnValue(canSyncEdOrgs && version === 'v2');
  const mutation = buildMutation();
  mockSyncEdOrgsQuery.mockReturnValue(mutation);
  return mutation;
};

describe('useSyncEdOrgsAction', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a SyncEdOrgs action entry for v2 environments with edorg:read privilege', () => {
    setupMocks('v2', true);

    const result = useSyncEdOrgsAction();

    expect(result).toHaveProperty('SyncEdOrgs');
    expect(result.SyncEdOrgs).toMatchObject({
      text: 'Sync Ed-Orgs',
      title: 'Sync education organizations from Admin API',
      isPending: false,
    });
    expect(result.SyncEdOrgs).toHaveProperty('icon');
    expect(result.SyncEdOrgs).toHaveProperty('onClick');
  });

  it('returns an empty object for non-v2 environments', () => {
    setupMocks('v1');

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('returns an empty object for startingBlocks environments', () => {
    setupMocks('startingBlocks' as any);

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('returns an empty object when version is undefined', () => {
    setupMocks(undefined);

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('returns an empty object when user lacks edorg:read privilege', () => {
    setupMocks('v2', false);

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('calls mutateAsync with empty path params on click', () => {
    const popBanner = jest.fn();
    mockUsePopBanner.mockReturnValue(popBanner);
    const mutation = setupMocks('v2', true);

    const result = useSyncEdOrgsAction();
    (result as ActionsType & { SyncEdOrgs: ActionProps }).SyncEdOrgs.onClick();

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      { entity: {}, pathParams: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('reflects isPending state from the mutation', () => {
    setupMocks('v2', true);
    mockSyncEdOrgsQuery.mockReturnValue(buildMutation({ isPending: true }));

    const result = useSyncEdOrgsAction();

    expect((result as ActionsType & { SyncEdOrgs: ActionProps }).SyncEdOrgs.isPending).toBe(true);
  });
});

