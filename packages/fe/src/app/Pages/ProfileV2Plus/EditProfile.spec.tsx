import 'reflect-metadata';
import { EditProfile } from './EditProfile';

// EditProfile is invoked directly as a plain function below (not rendered via a
// test renderer), so React's real hook dispatcher is never installed. Shim useMemo
// and useState the same way CreateProfilePage.spec.tsx does (Task 5) — they'd
// otherwise crash with "Cannot read properties of null" outside an actual render.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => [initial, jest.fn()],
}));
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useProfileConfig } from './profileConfig';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
}));

jest.mock('@hookform/resolvers/class-validator', () => ({
  classValidatorResolver: jest.fn((Dto) => Dto),
}));

jest.mock('../../Layout/FeedbackBanner', () => ({
  usePopBanner: jest.fn(() => jest.fn()),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../helpers/mutationErrCallback', () => ({
  mutationErrCallback: jest.fn(() => ({})),
}));

jest.mock('./profileConfig', () => ({
  useProfileConfig: Object.assign(jest.fn(), { match: jest.fn() }),
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockUseForm = useForm as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockMatch = useProfileConfig.match as jest.Mock;

const profile = { id: 5, name: 'Test Profile', definition: '<Profile/>' };

const setup = (version: 'v2' | 'v3') => {
  const putMutateAsync = jest.fn().mockResolvedValue(profile);
  mockUseNavigate.mockReturnValue(jest.fn());
  mockUseParams.mockReturnValue({ profileId: '5' });
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    teamId: 1,
    edfiTenant: { id: 3, sbEnvironmentId: 2 },
  });
  mockUseForm.mockReturnValue({
    register: jest.fn(() => ({})),
    setError: jest.fn(),
    setValue: jest.fn(),
    handleSubmit: (submit: (data: Record<string, unknown>) => Promise<void>) => () => submit({ name: 'Updated Profile' }),
    formState: { errors: {}, isSubmitting: false },
  });
  const config = {
    version,
    queries: { put: jest.fn(() => ({ mutateAsync: putMutateAsync })) },
    PutDto: class PutDtoStub {
      constructor() {
        Object.assign(this, {});
      }
    },
  };
  mockMatch.mockImplementation((handlers: Record<string, (cfg: typeof config) => unknown>) =>
    handlers[version](config)
  );
  return { putMutateAsync };
};

// EditProfile dispatches via `.match()` to a per-version `EditProfileForm`, so
// getting to the actual <form> requires invoking that inner component too
// (same "call as a plain function" approach as EditProfile itself, one level
// deeper).
const getFormElement = (profileProp: typeof profile) => {
  const outer = EditProfile({ profile: profileProp }) as React.ReactElement;
  return (outer.type as (props: unknown) => React.ReactElement)(outer.props);
};

describe('EditProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('puts via useProfileConfig().queries for a v2 tenant', async () => {
    const { putMutateAsync } = setup('v2');

    const form = getFormElement(profile);
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'Updated Profile' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('puts via useProfileConfig().queries for a v3 tenant', async () => {
    const { putMutateAsync } = setup('v3');

    const form = getFormElement(profile);
    await form.props.onSubmit();

    expect(putMutateAsync).toHaveBeenCalledWith(
      { entity: { name: 'Updated Profile' } },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
