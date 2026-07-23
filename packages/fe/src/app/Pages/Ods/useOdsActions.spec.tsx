import 'reflect-metadata';
import { useOdsActions } from './useOdsActions';
import { ActionProps, ActionsType } from '@edanalytics/common-ui';
import { useNavigate, useParams } from 'react-router-dom';
import {
  teamEdfiTenantAuthConfig,
  useAuthorize,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { dbInstancesV2, odsQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

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

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../api', () => ({
  odsQueries: { delete: jest.fn() },
  dbInstancesV2: { delete: jest.fn() },
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockUseAuthorize = useAuthorize as jest.Mock;
const mockUsePopBanner = usePopBanner as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockOdsDelete = odsQueries.delete as jest.Mock;
const mockDbInstancesDelete = dbInstancesV2.delete as jest.Mock;
const mockMutationErrCallback = mutationErrCallback as jest.Mock;
const mockTeamEdfiTenantAuthConfig = teamEdfiTenantAuthConfig as jest.Mock;

describe('useOdsActions', () => {
  const navigateSpy = jest.fn();
  const popBannerSpy = jest.fn();
  const odsMutateAsync = jest.fn();
  const dbInstancesMutateAsync = jest.fn();

  const setup = (startingBlocks: boolean) => {
    mockUseNavigate.mockReturnValue(navigateSpy);
    mockUseParams.mockReturnValue({ odsId: '5' });
    mockUsePopBanner.mockReturnValue(popBannerSpy);
    mockUseAuthorize.mockReturnValue(true);
    mockUseNavContext.mockReturnValue({
      teamId: 1,
      sbEnvironmentId: 2,
      edfiTenantId: 3,
      edfiTenant: { id: 3 },
      sbEnvironment: { startingBlocks },
    });
    mockMutationErrCallback.mockReturnValue({});
    mockOdsDelete.mockReturnValue({ isPending: false, mutateAsync: odsMutateAsync });
    mockDbInstancesDelete.mockReturnValue({ isPending: false, mutateAsync: dbInstancesMutateAsync });
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses dbInstancesV2 delete mutation for non-startingBlocks ODSs with dbInstanceId > 0', () => {
    setup(false);

    const result = useOdsActions({ id: 5, dbInstanceId: 77 } as any);
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(mockDbInstancesDelete).toHaveBeenCalledWith({ edfiTenant: { id: 3 }, teamId: 1 });
    expect(dbInstancesMutateAsync).toHaveBeenCalledWith(
      { id: 77 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(odsMutateAsync).not.toHaveBeenCalled();
  });

  it('does not expose Delete action for non-startingBlocks ODSs without dbInstanceId', () => {
    setup(false);

    const result = useOdsActions({ id: 5, dbInstanceId: null } as any);

    expect(result).not.toHaveProperty('Delete');
  });

  it('uses odsQueries.delete for startingBlocks with id=ods.id', () => {
    setup(true);

    const result = useOdsActions({ id: 5, dbInstanceId: null } as any);
    (result as ActionsType & { Delete: ActionProps }).Delete.onClick();

    expect(mockOdsDelete).toHaveBeenCalledWith({ edfiTenant: { id: 3 }, teamId: 1 });
    expect(odsMutateAsync).toHaveBeenCalledWith(
      { id: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(dbInstancesMutateAsync).not.toHaveBeenCalled();
  });
});
