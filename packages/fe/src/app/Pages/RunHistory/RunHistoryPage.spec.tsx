import 'reflect-metadata';
import { render, screen } from '@testing-library/react';
import { useParams } from 'react-router';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import { RunHistoryPage } from './RunHistoryPage';
import { useTeamRunHistory } from './useTeamRunHistory';

// The real react-router is ESM-only and can't be loaded by this Jest setup.
jest.mock('react-router', () => ({
  useParams: jest.fn(),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../MyProducts/useCanSeeCertification', () => ({
  useCanSeeCertification: jest.fn(),
}));

jest.mock('./useTeamRunHistory', () => ({ useTeamRunHistory: jest.fn() }));

jest.mock('../../routes/paths', () => ({
  certificationRunPath: (asId: number, runId: number) => `/as/${asId}/certification/runs/${runId}`,
}));

jest.mock('@edanalytics/common-ui', () => ({
  PageContentCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SbaaTableAllInOne: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[];
    columns: {
      accessorKey?: string;
      id?: string;
      cell?: (info: { row: { original: Record<string, unknown> } }) => React.ReactNode;
    }[];
  }) => (
    <table>
      <tbody>
        {data.map((original) => (
          <tr key={String(original.id)}>
            {columns.map((column) => (
              <td key={column.accessorKey ?? column.id}>
                {column.cell
                  ? column.cell({ row: { original } })
                  : String(original[column.accessorKey as string])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const mockUseParams = useParams as jest.Mock;
const mockUseCanSee = useCanSeeCertification as jest.Mock;
const mockUseRunHistory = useTeamRunHistory as jest.Mock;

const row = (overrides: object = {}) => ({
  runId: 42,
  edfiTenantId: 3,
  odsId: 8,
  environmentName: 'Env 1',
  tenantName: 'tenant1',
  dataStoreName: 'EdFi_Ods_1',
  certificationModel: 'SIS',
  status: 'DRAFT',
  createdAt: '2026-09-07T13:00:00.000Z',
  completedScenarios: 12,
  totalScenarios: 30,
  ...overrides,
});

describe('RunHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ asId: '7' });
    mockUseCanSee.mockReturnValue({ canSee: true, isLoading: false, error: null });
    mockUseRunHistory.mockReturnValue({ data: [row()], isLoading: false, error: null });
  });

  it('only fetches once the user is known to see certification', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: true, error: null });
    render(<RunHistoryPage />);
    expect(mockUseRunHistory).toHaveBeenCalledWith(7, false);
  });

  it('shows a spinner while access or data loads', () => {
    mockUseRunHistory.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<RunHistoryPage />);
    expect(screen.getByText('Run history')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('throws Not allowed when the user cannot see certification', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: false, error: null });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<RunHistoryPage />)).toThrow('Not allowed');
    consoleError.mockRestore();
  });

  it('rethrows a failed list request instead of reporting Not allowed', () => {
    mockUseRunHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<RunHistoryPage />)).toThrow('boom');
    consoleError.mockRestore();
  });

  it('shows the empty state when the team has no runs', () => {
    mockUseRunHistory.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<RunHistoryPage />);
    expect(screen.getByText('No certification runs yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders rows in API order with status label and "12 / 30" progress', () => {
    mockUseRunHistory.mockReturnValue({
      data: [
        row({ runId: 9, status: 'APPROVED', completedScenarios: 12, totalScenarios: 30 }),
        row({ runId: 3, status: 'CHANGES_REQUESTED' }),
      ],
      isLoading: false,
      error: null,
    });
    render(<RunHistoryPage />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Env 1 · tenant1 · EdFi_Ods_1');
    expect(rows[0].textContent).toContain('SIS');
    expect(rows[0].textContent).toContain('Approved');
    expect(rows[0].textContent).toContain('12 / 30 scenarios completed');
    expect(rows[1].textContent).toContain('Changes requested');
    const bar = screen.getAllByRole('progressbar')[0];
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-label')).toBe('12 / 30 scenarios completed');
  });

  it('renders 0 / 0 with an empty bar for a run without scenarios', () => {
    mockUseRunHistory.mockReturnValue({
      data: [row({ completedScenarios: 0, totalScenarios: 0 })],
      isLoading: false,
      error: null,
    });
    render(<RunHistoryPage />);
    expect(screen.getByText('0 / 0 scenarios completed')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('formats Started like Last updated on the dashboard', () => {
    render(<RunHistoryPage />);
    expect(document.body.textContent).toContain(
      new Date('2026-09-07T13:00:00.000Z').toLocaleString(),
    );
  });

  it('links Open to the run Scenarios page', () => {
    render(<RunHistoryPage />);
    expect(screen.getByText('Open').closest('a')?.getAttribute('href')).toBe(
      '/as/7/certification/runs/42',
    );
  });
});
