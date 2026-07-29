import 'reflect-metadata';
import { ProfilesPageContent } from './ProfilesPage';
import { useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { useProfileConfig } from './profileConfig';

jest.mock('@edanalytics/common-ui', () => ({
  PageActions: () => null,
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  SbaaTableAllInOne: (props: { data: unknown[] }) => JSON.stringify(props.data),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('./profileConfig', () => ({
  useProfileConfig: jest.fn(),
}));

jest.mock('./NameCell', () => ({ NameCell: () => null }));

// useProfileActions.tsx is migrated to useProfileConfig in a later task (Task 4);
// until then it still imports the real '../../api' module chain, which pulls in
// config.ts's `import.meta.env` and breaks under Jest. Mock it out here so this
// spec exercises ProfilesPageContent in isolation, same as the NameCell mock above.
jest.mock('./useProfileActions', () => ({
  useManyProfileActions: jest.fn(() => ({})),
  useProfileActions: jest.fn(() => ({})),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockUseProfileConfig = useProfileConfig as jest.Mock;

const setup = (version: 'v2' | 'v3') => {
  const getAll = jest.fn(() => ({ queryKey: ['profiles'] }));
  mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
    edfiTenant: { id: 3 },
    asId: 1,
  });
  mockUseProfileConfig.mockReturnValue({ version, queries: { getAll } });
  mockUseQuery.mockReturnValue({ data: { 5: { id: 5, name: 'Test Profile' } } });
  return { getAll };
};

describe('ProfilesPageContent', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls useProfileConfig().queries.getAll for a v2 tenant', () => {
    const { getAll } = setup('v2');

    ProfilesPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });

  it('calls useProfileConfig().queries.getAll for a v3 tenant', () => {
    const { getAll } = setup('v3');

    ProfilesPageContent();

    expect(getAll).toHaveBeenCalledWith({ teamId: 1, edfiTenant: { id: 3 } });
  });
});
