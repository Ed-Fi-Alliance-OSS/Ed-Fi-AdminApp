import 'reflect-metadata';
import { useSyncEdOrgsAction } from './useSyncEdOrgsAction';
import { ActionsType, ActionProps } from '@edanalytics/common-ui';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(),
}));

jest.mock('../../api', () => ({
  odsQueries: {
    syncEdOrgs: jest.fn(),
  },
}));

import { useParams } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';

const mockUseParams = useParams as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUsePopBanner = usePopBanner as jest.Mock;
const mockSyncEdOrgsQuery = odsQueries.syncEdOrgs as jest.Mock;

const buildSbEnvironment = (version: 'v1' | 'v2' | undefined, startingBlocks = false) => ({
  id: 1,
  configPublic: version ? { version, startingBlocks } : undefined,
  startingBlocks,
});

const buildEdfiTenant = () => ({ id: 10, sbEnvironment: buildSbEnvironment('v2') });

const buildMutation = (overrides: object = {}) => ({
  isPending: false,
  mutateAsync: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const setupMocks = (version: 'v1' | 'v2' | undefined, startingBlocks = false) => {
  mockUseParams.mockReturnValue({ odsId: '5' });
  mockUsePopBanner.mockReturnValue(jest.fn());
  mockUseNavContext.mockReturnValue({
    edfiTenant: buildEdfiTenant(),
    sbEnvironment: buildSbEnvironment(version, startingBlocks),
    teamId: 1,
  });
  const mutation = buildMutation();
  mockSyncEdOrgsQuery.mockReturnValue(mutation);
  return mutation;
};

describe('useSyncEdOrgsAction', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a SyncEdOrgs action entry for v2 environments', () => {
    setupMocks('v2');

    const result = useSyncEdOrgsAction();

    expect(result).toHaveProperty('SyncEdOrgs');
    expect(result.SyncEdOrgs).toMatchObject({
      text: 'Sync Ed-Orgs',
      isPending: false,
    });
  });

  it('returns an empty object for non-v2 environments', () => {
    setupMocks('v1');

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('returns an empty object when version is undefined', () => {
    setupMocks(undefined);

    const result = useSyncEdOrgsAction();

    expect(result).toEqual({});
  });

  it('calls mutateAsync with odsId path param on click', () => {
    const popBanner = jest.fn();
    mockUsePopBanner.mockReturnValue(popBanner);
    const mutation = setupMocks('v2');

    const result = useSyncEdOrgsAction();
    (result as ActionsType & { SyncEdOrgs: ActionProps }).SyncEdOrgs.onClick();

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      { entity: {}, pathParams: { odsId: '5' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('reflects isPending state from the mutation', () => {
    setupMocks('v2');
    mockSyncEdOrgsQuery.mockReturnValue(buildMutation({ isPending: true }));

    const result = useSyncEdOrgsAction();

    expect((result as ActionsType & { SyncEdOrgs: ActionProps }).SyncEdOrgs.isPending).toBe(true);
  });
});
