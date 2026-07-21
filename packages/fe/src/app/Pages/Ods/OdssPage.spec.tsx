import 'reflect-metadata';
import { OdssTable } from './OdssPage';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api/queries/queries';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  SbaaTableAllInOne: () => null,
  TableRowActions: () => null,
}));

jest.mock('@chakra-ui/react', () => ({
  Badge: () => null,
  HStack: ({ children }: { children: React.ReactNode }) => children,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-router-dom', () => ({
  Link: () => null,
  useNavigate: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

jest.mock('../../api/queries/queries', () => ({
  odsQueries: { getAll: jest.fn() },
}));

const mockUseQuery = useQuery as jest.Mock;
const mockOdsGetAll = odsQueries.getAll as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;

describe('OdssTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
      teamId: 1,
      edfiTenant: { id: 3, sbEnvironmentId: 2 },
    });
    mockOdsGetAll.mockReturnValue({ queryKey: ['odss'], queryFn: jest.fn() });
    mockUseQuery.mockReturnValue({ data: {} });
  });

  it('disables cache reuse on the ODS list query', () => {
    OdssTable();

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        gcTime: 0,
        staleTime: 0,
      })
    );
  });
});
