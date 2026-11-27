import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { CertificationQueuePage } from './CertificationQueuePage';
import { useCertificationRunList } from './useCertificationRunList';

jest.mock('@tanstack/react-query', () => ({ useQueryClient: jest.fn(() => ({})) }));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(),
  usePrivilegeCacheForConfig: jest.fn(),
}));

jest.mock('./useCertificationRunList', () => ({ useCertificationRunList: jest.fn() }));

jest.mock('react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../CertificationReview/PickUpCertificationRunButton', () => ({
  PickUpCertificationRunButton: ({
    runId,
    isDisabled,
    disabledReason,
  }: {
    runId: number;
    isDisabled?: boolean;
    disabledReason?: string;
  }) => (
    <button disabled={isDisabled} title={disabledReason} data-testid={`pick-up-${runId}`}>
      Pick up
    </button>
  ),
}));

type MockColumn = {
  id?: string;
  accessorKey?: string;
  accessorFn?: (row: Record<string, unknown>) => unknown;
  header: string;
  filterFn?: string;
  meta?: { type?: string };
  cell?: (info: { row: { original: Record<string, unknown> } }) => React.ReactNode;
};

let capturedColumns: MockColumn[] = [];

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  PageContentCard: ({ children }: { children?: React.ReactNode }) => <section>{children}</section>,
  SbaaTableAllInOne: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[];
    columns: MockColumn[];
  }) => {
    capturedColumns = columns;
    return (
      <table>
        <tbody>
          {data.map((original) => (
            <tr key={String(original.id)}>
              {columns.map((column) => (
                <td key={column.id ?? column.accessorKey}>
                  {column.cell
                    ? column.cell({ row: { original } })
                    : String(
                        column.accessorFn
                          ? column.accessorFn(original)
                          : original[column.accessorKey as string],
                      )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

const mockAuthorize = authorize as jest.Mock;
const mockCache = usePrivilegeCacheForConfig as jest.Mock;
const mockHook = useCertificationRunList as jest.Mock;

const run = (overrides: Record<string, unknown> = {}) => ({
  runId: 1,
  teamName: 'Team A',
  sbEnvironmentName: 'Env 1',
  edfiTenantName: 'tenant1',
  dataStore: 'Ods One',
  certificationModel: 'SIS',
  status: 'READY_FOR_REVIEW',
  statusChangedAt: '2026-11-10T10:00:00.000Z',
  submittedAt: '2026-11-09T10:00:00.000Z',
  updatedAt: '2026-11-12T10:00:00.000Z',
  ...overrides,
});

const setup = (
  query: Record<string, unknown>,
  { canRead = true, canReview = true, cacheLoading = false } = {},
) => {
  mockCache.mockReturnValue([{ isLoading: cacheLoading }]);
  mockAuthorize.mockImplementation(({ config }: { config: { privilege: string } }) =>
    config.privilege === 'certification:review' ? canReview : canRead,
  );
  mockHook.mockReturnValue({ data: undefined, error: null, isLoading: false, ...query });
};

const quiet = (fn: () => void) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

const rowOf = (runId: number) =>
  screen.getByTestId(`pick-up-${runId}`).closest('tr') as HTMLElement;

describe('CertificationQueuePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedColumns = [];
  });

  it('shows a spinner while the privilege cache loads', () => {
    setup({}, { canRead: false, cacheLoading: true });
    render(<CertificationQueuePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Not allowed')).toBeNull();
  });

  it('rethrows a failed privilege cache request', () => {
    setup({}, { canRead: false });
    mockCache.mockReturnValue([{ isLoading: false, error: new Error('Auth cache failed') }]);
    quiet(() => expect(() => render(<CertificationQueuePage />)).toThrow('Auth cache failed'));
  });

  it('throws "Not allowed" without certification:read and does not fetch', () => {
    setup({}, { canRead: false });
    quiet(() => expect(() => render(<CertificationQueuePage />)).toThrow('Not allowed'));
    expect(mockHook).toHaveBeenCalledWith(false);
  });

  it('rethrows a failed list request instead of "Not allowed"', () => {
    setup({ error: new Error('Request failed with status code 500') });
    quiet(() =>
      expect(() => render(<CertificationQueuePage />)).toThrow(
        'Request failed with status code 500',
      ),
    );
  });

  it('shows a spinner while the list loads', () => {
    setup({ isLoading: true });
    render(<CertificationQueuePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "No certification runs yet." with no runs', () => {
    setup({ data: { rows: [], total: 0 } });
    render(<CertificationQueuePage />);
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeInTheDocument();
    expect(screen.getByText('No certification runs yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('lists product, vendor, model, status and last activity for each run', () => {
    setup({ data: { rows: [run()], total: 1 } });
    render(<CertificationQueuePage />);
    const row = within(rowOf(1));
    expect(row.getByText('Ods One')).toBeInTheDocument();
    expect(row.getByText('Team A')).toBeInTheDocument();
    expect(row.getByText('SIS')).toBeInTheDocument();
    expect(row.getByText('Ready for review')).toBeInTheDocument();
    expect(
      row.getByText(new Date('2026-11-12T10:00:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('renders "—" for a missing team and falls back to environment / tenant without a data store', () => {
    setup({ data: { rows: [run({ teamName: null, dataStore: null })], total: 1 } });
    render(<CertificationQueuePage />);
    const row = within(rowOf(1));
    expect(row.getByText('—')).toBeInTheDocument();
    expect(row.getByText('Env 1 / tenant1')).toBeInTheDocument();
  });

  it('renders Open and Pick up on every row, Open linking to the review page', () => {
    setup({
      data: {
        rows: [run({ runId: 1 }), run({ runId: 2, status: 'APPROVED' })],
        total: 2,
      },
    });
    render(<CertificationQueuePage />);
    expect(within(rowOf(1)).getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/certification/runs/1/review',
    );
    expect(within(rowOf(2)).getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/certification/runs/2/review',
    );
    expect(screen.getAllByRole('button', { name: 'Pick up' })).toHaveLength(2);
  });

  it('enables Pick up only for ready-for-review statuses', () => {
    setup({
      data: {
        rows: [
          run({ runId: 1, status: 'READY_FOR_REVIEW' }),
          run({ runId: 2, status: 'READY_FOR_REVIEW_WITH_CHANGES' }),
          run({ runId: 3, status: 'IN_REVIEW' }),
          run({ runId: 4, status: 'DRAFT' }),
        ],
        total: 4,
      },
    });
    render(<CertificationQueuePage />);
    expect(screen.getByTestId('pick-up-1')).toBeEnabled();
    expect(screen.getByTestId('pick-up-2')).toBeEnabled();
    expect(screen.getByTestId('pick-up-3')).toBeDisabled();
    expect(screen.getByTestId('pick-up-3')).toHaveAttribute('title', 'Already picked up');
    expect(screen.getByTestId('pick-up-4')).toBeDisabled();
  });

  it('disables Pick up for a user without certification:review but keeps Open', () => {
    setup({ data: { rows: [run()], total: 1 } }, { canReview: false });
    render(<CertificationQueuePage />);
    expect(screen.getByTestId('pick-up-1')).toBeDisabled();
    expect(screen.getByTestId('pick-up-1')).toHaveAttribute('title', 'You need review permission');
    expect(within(rowOf(1)).getByRole('link', { name: /Open/ })).toBeInTheDocument();
  });

  it('filters by status through an options filter on the Status column', () => {
    setup({ data: { rows: [run()], total: 1 } });
    render(<CertificationQueuePage />);
    const status = capturedColumns.find((column) => column.id === 'status');
    expect(status).toMatchObject({
      header: 'Status',
      filterFn: 'equalsString',
      meta: { type: 'options' },
    });
  });

  it('keeps the API order: the rows reach the table as received', () => {
    setup({
      data: { rows: [run({ runId: 9 }), run({ runId: 3 }), run({ runId: 5 })], total: 3 },
    });
    render(<CertificationQueuePage />);
    const order = screen
      .getAllByRole('button', { name: 'Pick up' })
      .map((button) => button.getAttribute('data-testid'));
    expect(order).toEqual(['pick-up-9', 'pick-up-3', 'pick-up-5']);
  });
});
