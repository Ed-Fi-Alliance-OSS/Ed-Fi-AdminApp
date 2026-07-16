import 'reflect-metadata';
import { CreateOds } from './CreateOdsPage';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { odsQueries, dbInstancesV2, edorgQueries } from '../../api';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  SelectOdsTemplate: () => null,
  useNavToParent: jest.fn(() => '/parent'),
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('../../api', () => ({
  odsQueries: { post: jest.fn() },
  dbInstancesV2: { post: jest.fn() },
  edorgQueries: { syncEdOrgs: jest.fn() },
}));

const mockUseForm = useForm as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockOdsPost = odsQueries.post as jest.Mock;
const mockDbInstancesPost = dbInstancesV2.post as jest.Mock;
const mockEdorgSync = edorgQueries.syncEdOrgs as jest.Mock;

const navSpy = jest.fn();
const odsMutateAsync = jest.fn();
const dbInstancesMutateAsync = jest.fn();
const syncEdOrgsMutateAsync = jest.fn();
const getFormElement = () => {
  const result = CreateOds() as React.ReactElement;
  return result.type === 'form' ? result : (result.props.children as React.ReactElement);
};

const setup = (startingBlocks: boolean, formData: Record<string, unknown>) => {
  mockUseNavigate.mockReturnValue(navSpy);
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    asId: 1,
    sbEnvironmentId: 2,
    edfiTenantId: 3,
    edfiTenant: { id: 3 },
    sbEnvironment: { startingBlocks },
  });

  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    control: {},
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit(formData),
    setError: jest.fn(),
    formState: { errors: {}, isSubmitting: false },
  });

  odsMutateAsync.mockImplementation(
    (_args: unknown, callbacks: { onSuccess?: (result: { id: number }) => void }) => {
      callbacks.onSuccess?.({ id: 101 });
      return Promise.resolve({ id: 101 });
    }
  );
  dbInstancesMutateAsync.mockImplementation(
    (_args: unknown, callbacks: { onSuccess?: (result: { id: number }) => void }) => {
      callbacks.onSuccess?.({ id: 202 });
      return Promise.resolve({ id: 202 });
    }
  );
  mockOdsPost.mockReturnValue({ mutateAsync: odsMutateAsync });
  mockDbInstancesPost.mockReturnValue({ mutateAsync: dbInstancesMutateAsync });
  mockEdorgSync.mockReturnValue({ mutateAsync: syncEdOrgsMutateAsync });
  syncEdOrgsMutateAsync.mockResolvedValue({});
};

describe('CreateOds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses dbinstances mutation then tenant edorg sync and redirects to list for non-startingBlocks', async () => {
    setup(false, { name: 'ODS One', databaseTemplate: 'Minimal' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(dbInstancesMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'ODS One', databaseTemplate: 'Minimal' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(odsMutateAsync).not.toHaveBeenCalled();
    expect(syncEdOrgsMutateAsync).toHaveBeenCalledWith(
      { entity: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(navSpy).toHaveBeenCalledWith('/parent');
  });

  it('uses ods mutation for startingBlocks', async () => {
    setup(true, { name: 'ODS One', templateName: 'GrandBend' });

    const form = getFormElement();
    await form.props.onSubmit();

    expect(odsMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'ODS One', templateName: 'GrandBend' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(dbInstancesMutateAsync).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith('/as/1/sb-environments/2/edfi-tenants/3/odss/101');
  });
});
