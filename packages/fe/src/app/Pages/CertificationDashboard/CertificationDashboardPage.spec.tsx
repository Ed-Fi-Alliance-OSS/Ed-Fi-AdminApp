import { render, screen, within } from '@testing-library/react';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { CertificationDashboardPage } from './CertificationDashboardPage';
import { useCertificationDashboard } from './useCertificationDashboard';

jest.mock('@tanstack/react-query', () => ({ useQueryClient: jest.fn(() => ({})) }));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(),
  usePrivilegeCacheForConfig: jest.fn(),
}));

jest.mock('./useCertificationDashboard', () => ({ useCertificationDashboard: jest.fn() }));

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const mockAuthorize = authorize as jest.Mock;
const mockCache = usePrivilegeCacheForConfig as jest.Mock;
const mockHook = useCertificationDashboard as jest.Mock;

const run = (overrides: Record<string, unknown> = {}) => ({
  runId: 1,
  teamName: 'Team A',
  sbEnvironmentName: 'Env 1',
  edfiTenantName: 'tenant1',
  dataStore: 'Ods One',
  certificationModel: 'SIS',
  status: 'READY_FOR_REVIEW',
  statusChangedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  updatedAt: '2026-11-12T10:00:00.000Z',
  ...overrides,
});

const dashboard = (overrides: Record<string, unknown> = {}) => ({
  counts: { newlyReadyForReview: 5, readyWithNewChanges: 6, pickedUp: 7, runsInFlight: 8 },
  waiting: { rows: [], total: 0 },
  others: { rows: [], total: 0 },
  ...overrides,
});

const setup = (query: Record<string, unknown>, { canRead = true, cacheLoading = false } = {}) => {
  mockCache.mockReturnValue([{ isLoading: cacheLoading }]);
  mockAuthorize.mockReturnValue(canRead);
  mockHook.mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    dataUpdatedAt: Date.now(),
    ...query,
  });
};

const quiet = (fn: () => void) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

describe('CertificationDashboardPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a spinner while the privilege cache loads', () => {
    setup({}, { canRead: false, cacheLoading: true });
    expect(() => render(<CertificationDashboardPage />)).not.toThrow();
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('Not allowed')).toBeNull();
  });

  it('throws "Not allowed" without certification:read', () => {
    setup({}, { canRead: false });
    quiet(() => expect(() => render(<CertificationDashboardPage />)).toThrow('Not allowed'));
    expect(mockHook).toHaveBeenCalledWith(false);
  });

  it('rethrows a failed dashboard request instead of "Not allowed"', () => {
    setup({ error: new Error('Request failed with status code 500') });
    quiet(() =>
      expect(() => render(<CertificationDashboardPage />)).toThrow(
        'Request failed with status code 500',
      ),
    );
  });

  it('shows a spinner while the dashboard loads', () => {
    setup({ isLoading: true });
    render(<CertificationDashboardPage />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the four cards with the ticket labels and counts', () => {
    setup({ data: dashboard() });
    render(<CertificationDashboardPage />);
    for (const [label, count] of [
      ['Newly Ready for Review', '5'],
      ['Ready for review with new changes', '6'],
      ['Picked up', '7'],
      ['Runs in flight', '8'],
    ]) {
      const card = screen.getByText(label).closest('div') as HTMLElement;
      expect(within(card).getByText(count)).toBeTruthy();
    }
  });

  it('renders the Waiting for review table in API order', () => {
    setup({
      data: dashboard({
        waiting: {
          rows: [
            run({ runId: 1, teamName: 'First Team' }),
            run({ runId: 2, teamName: null, dataStore: null }),
            run({ runId: 3, teamName: 'Third Team', status: 'READY_FOR_REVIEW_WITH_CHANGES' }),
          ],
          total: 3,
        },
      }),
    });
    render(<CertificationDashboardPage />);

    const table = screen.getByRole('table', { name: 'Waiting for review' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(['Team', 'Data store', 'Certification Model', 'Status', 'Waiting']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('First Team');
    expect(within(rows[1]).getAllByText('—')).toHaveLength(1);
    // No ODS: fall back to environment / tenant so rows stay distinguishable.
    expect(rows[1].textContent).toContain('Env 1 / tenant1');
    expect(rows[2].textContent).toContain('Third Team');
    expect(rows[2].textContent).toContain('Ready for review with new changes');
    expect(rows[0].textContent).toContain('3h 0m');
  });

  it('says nothing is waiting for review when waiting.total is 0', () => {
    setup({ data: dashboard() });
    render(<CertificationDashboardPage />);
    expect(screen.getByText('Nothing is waiting for review')).toBeTruthy();
  });

  it('renders the Runs in flight or rejected table with Last updated column', () => {
    setup({
      data: dashboard({
        others: { rows: [run({ runId: 9, status: 'IN_REVIEW' })], total: 1 },
      }),
    });
    render(<CertificationDashboardPage />);

    const table = screen.getByRole('table', { name: 'Runs in flight or rejected' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      'Team',
      'Data store',
      'Certification Model',
      'Status',
      'Last updated',
    ]);
    expect(within(table).getByText('In review')).toBeTruthy();
  });

  it('shows "Showing 100 of N" when others.total exceeds rows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => run({ runId: i + 1, status: 'DRAFT' }));
    setup({ data: dashboard({ others: { rows, total: 250 } }) });
    render(<CertificationDashboardPage />);
    expect(screen.getByText('Showing 100 of 250')).toBeTruthy();
  });

  it('does not show the "Showing" note when every run is listed', () => {
    setup({ data: dashboard({ others: { rows: [run({ status: 'DRAFT' })], total: 1 } }) });
    render(<CertificationDashboardPage />);
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('shows the "Accurate as of page load" line', () => {
    setup({ data: dashboard() });
    render(<CertificationDashboardPage />);
    expect(screen.getByText(/Accurate as of page load/)).toBeTruthy();
  });
});
