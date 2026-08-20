import 'reflect-metadata';
import { EditApplication } from './EditApplication';

jest.mock('react', () => ({ ...jest.requireActual('react'), useMemo: (factory: () => unknown) => factory() }));

import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useApplicationConfig } from './applicationConfig';

jest.mock('react-router', () => ({ useNavigate: jest.fn() }));
jest.mock('react-hook-form', () => ({ useForm: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(() => ({ data: {} })), useQueryClient: jest.fn() }));
jest.mock('@hookform/resolvers/class-validator', () => ({ classValidatorResolver: jest.fn((Dto) => Dto) }));
jest.mock('../../Layout/FeedbackBanner', () => ({ usePopBanner: jest.fn(() => jest.fn()) }));
jest.mock('../../helpers', () => ({ useTeamEdfiTenantNavContextLoaded: jest.fn(), getRelationDisplayName: jest.fn(() => '-') }));
jest.mock('../../helpers/mutationErrCallback', () => ({ mutationErrCallback: jest.fn(() => ({})) }));
jest.mock('../../helpers/EntitySelectors', () => ({
  SelectClaimsetV2: () => null,
  SelectEdorg: () => null,
  SelectOds: () => null,
  SelectProfile: () => null,
  SelectVendorV2: () => null,
}));
jest.mock('../../api', () => ({ applicationQueriesV2: { put: jest.fn() }, claimsetQueriesV2: { getAll: jest.fn() }, edorgQueries: { getAll: jest.fn() }, profileQueriesV2: { getAll: jest.fn() }, queryKey: jest.fn() }));
jest.mock('../../api-v2', () => ({ QUERY_KEYS: { edfiTenants: 'edfiTenants', applications: 'applications', integrationProviders: 'integrationProviders', integrationApps: 'integrationApps' } }));
jest.mock('@edanalytics/common-ui', () => ({ Icons: { Delete: () => null, InfoCircle: () => null } }));
jest.mock('./applicationConfig', () => ({ useApplicationConfig: Object.assign(jest.fn(), { match: jest.fn() }) }));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useApplicationConfig.match as jest.Mock;

const getFormElement = () => {
  const outer = EditApplication({
    application: { id: 1, applicationName: 'App', vendorId: 1, claimSetName: 'CS', profileIds: [], educationOrganizationIds: [2], dataStoreIds: [3] } as never,
    claimset: { id: 5, name: 'CS' } as never,
  }) as React.ReactElement;
  return (outer.type as (props: unknown) => React.ReactElement)(outer.props);
};

const setup = (version: 'v2' | 'v3') => {
  const putMutateAsync = jest.fn().mockResolvedValue(undefined);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseNavContext.mockReturnValue({ edfiTenantId: 3, teamId: 1, edfiTenant: { id: 3, sbEnvironmentId: 2 } });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    watch: jest.fn(() => []),
    setValue: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit({ id: 1, applicationName: 'App' }),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });
  const config = {
    version,
    queries: { put: jest.fn(() => ({ mutateAsync: putMutateAsync })) },
    PutFormDto: class PutFormDtoStub {},
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) => handlers[version](config));
  return { putMutateAsync };
};

describe('EditApplication', () => {
  afterEach(() => jest.clearAllMocks());

  it('puts via useApplicationConfig().queries for a v2 tenant', async () => {
    const { putMutateAsync } = setup('v2');
    const form = getFormElement();
    await form.props.onSubmit();
    expect(putMutateAsync).toHaveBeenCalled();
  });

  it('puts via useApplicationConfig().queries for a v3 tenant', async () => {
    const { putMutateAsync } = setup('v3');
    const form = getFormElement();
    await form.props.onSubmit();
    expect(putMutateAsync).toHaveBeenCalled();
  });
});
