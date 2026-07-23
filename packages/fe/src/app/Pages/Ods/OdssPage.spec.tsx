import 'reflect-metadata';
import { OdssTable } from './OdssPage';
import { dbInstancesV2 } from '../../api';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api/queries/queries';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { View: 'ViewIcon', Delete: 'DeleteIcon' },
  PageTemplate: ({ children }: { children: React.ReactNode }) => children,
  PageActions: () => null,
  SbaaTableAllInOne: jest.fn(() => null),
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

jest.mock('../../api', () => ({
  dbInstancesV2: { delete: jest.fn() },
}));

const mockUseQuery = useQuery as jest.Mock;
const mockOdsGetAll = odsQueries.getAll as jest.Mock;
const mockUseTeamEdfiTenantNavContextLoaded = useTeamEdfiTenantNavContextLoaded as jest.Mock;
const mockDbInstancesDelete = dbInstancesV2.delete as jest.Mock;

describe('OdssTable', () => {
  const dbInstancesMutateAsync = jest.fn();

  const getDeleteAction = () => {
    const tableProps = (OdssTable() as React.ReactElement).props;
    const row = tableProps.data[0];
    const nameColumn = tableProps.columns.find((column: { accessorKey: string }) => column.accessorKey === 'displayName');
    const cell = nameColumn.cell({ row: { original: row } });
    const actionElement = (cell.props.children as React.ReactElement[])[1];
    return actionElement.props.actions.Delete;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamEdfiTenantNavContextLoaded.mockReturnValue({
      teamId: 1,
      edfiTenant: { id: 3, sbEnvironmentId: 2 },
      sbEnvironment: { startingBlocks: false },
    });
    mockOdsGetAll.mockReturnValue({ queryKey: ['odss'], queryFn: jest.fn() });
    mockUseQuery.mockReturnValue({
      data: {
        5: {
          id: 5,
          displayName: 'ODS 5',
          dbInstanceId: 88,
          instanceType: 'Shared',
          status: null,
        },
      },
    });
    mockDbInstancesDelete.mockReturnValue({ mutateAsync: dbInstancesMutateAsync });
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

  it('shows row Delete action only for non-startingBlocks ODS rows with dbInstanceId > 0', () => {
    mockUseQuery.mockReturnValue({
      data: {
        9: {
          id: 9,
          displayName: 'ODS 9',
          dbInstanceId: null,
          instanceType: 'Shared',
          status: null,
        },
      },
    });

    const deleteAction = getDeleteAction();

    expect(deleteAction).toBeUndefined();
  });

  it('routes non-startingBlocks row Delete action to dbInstances delete using dbInstanceId', () => {
    const deleteAction = getDeleteAction();
    deleteAction.onClick();

    expect(dbInstancesMutateAsync).toHaveBeenCalledWith(
      { id: 88 },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
