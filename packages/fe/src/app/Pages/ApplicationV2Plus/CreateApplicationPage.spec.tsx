import 'reflect-metadata';
import { CreateApplicationPageV2 } from './CreateApplicationPage';

jest.mock('react', () => ({ ...jest.requireActual('react'), useMemo: (factory: () => unknown) => factory() }));

import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useApplicationConfig } from './applicationConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  Icons: { Delete: () => null, InfoCircle: () => null },
}));
jest.mock('react-router', () => ({ useNavigate: jest.fn() }));
jest.mock('react-hook-form', () => ({ useForm: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@hookform/resolvers/class-validator', () => ({ classValidatorResolver: jest.fn((Dto) => Dto) }));
jest.mock('../../Layout/FeedbackBanner', () => ({ usePopBanner: jest.fn(() => jest.fn()) }));
jest.mock('../../helpers', () => ({
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
  getRelationDisplayName: jest.fn(() => '-'),
}));
jest.mock('../../helpers/mutationErrCallback', () => ({ mutationErrCallback: jest.fn(() => ({})) }));
jest.mock('../../helpers/EntitySelectors', () => ({
  SelectClaimsetV2: () => null,
  SelectEdorg: () => null,
  SelectOds: () => null,
  SelectProfile: () => null,
  SelectVendorV2: () => null,
}));
jest.mock('../../api', () => ({ edorgQueries: { getAll: jest.fn() }, profileQueriesV2: { getAll: jest.fn() }, odsQueries: { getAll: jest.fn(), put: jest.fn(() => ({ mutateAsync: jest.fn() })) } }));
jest.mock('../../api/queries/queries.v7', () => ({ odsInstancesV2: { getAll: jest.fn() }, dataStoresV3: { getAll: jest.fn() } }));
jest.mock('../../api-v2', () => ({ QUERY_KEYS: { edfiTenants: 'edfiTenants', applications: 'applications', integrationProviders: 'integrationProviders', integrationApps: 'integrationApps' } }));
jest.mock('./applicationConfig', () => ({ useApplicationConfig: Object.assign(jest.fn(), { match: jest.fn() }) }));
jest.mock('../Ods/useOdsTerminology', () => ({
  useOdsTerminology: jest.fn(() => ({ singular: 'ODS', plural: 'Ods', listTitle: 'ODS', createTitle: 'Create ODS' })),
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseNavToParent = useNavToParent as jest.Mock;
const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useApplicationConfig.match as jest.Mock;

const getFormElement = () => {
  const outer = CreateApplicationPageV2() as React.ReactElement;
  const inner = (outer.type as (props: unknown) => React.ReactElement)(outer.props);
  return inner;
};

const setup = (version: 'v2' | 'v3', formData: Record<string, unknown>) => {
  const postMutateAsync = jest.fn().mockResolvedValue({ id: 9 });
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseNavToParent.mockReturnValue('/parent');
  mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  mockUseQuery.mockReturnValue({ data: {} });
  mockUseNavContext.mockReturnValue({ edfiTenantId: 3, asId: 1, edfiTenant: { id: 3, sbEnvironmentId: 2 } });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    watch: jest.fn(() => undefined),
    setValue: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });
  const config = {
    version,
    queries: { post: jest.fn(() => ({ mutateAsync: postMutateAsync })) },
    PostFormDto: class PostFormDtoStub {},
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) => handlers[version](config));
  return { postMutateAsync };
};

describe('CreateApplicationPageV2', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts via useApplicationConfig().queries for a v2 tenant with no selected ODS', async () => {
    const { postMutateAsync } = setup('v2', { applicationName: 'App', odsInstanceId: undefined });
    const form = getFormElement();
    await form.props.children.props.onSubmit();
    expect(postMutateAsync).toHaveBeenCalled();
  });

  it('posts via useApplicationConfig().queries for a v3 tenant with no selected data store', async () => {
    const { postMutateAsync } = setup('v3', { applicationName: 'App', dataStoreId: undefined });
    const form = getFormElement();
    await form.props.children.props.onSubmit();
    expect(postMutateAsync).toHaveBeenCalled();
  });
});
