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
  PageContentCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ContentSection: ({
    heading,
    children,
  }: {
    heading?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      {heading ? <h2>{heading}</h2> : null}
      {children}
    </section>
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

  it('renders a Waiting for review card and a Runs in flight or rejected card', () => {
    setup({
      data: dashboard({
        waiting: { rows: [run({ runId: 1, teamName: 'Waiting Team' })], total: 1 },
        others: { rows: [run({ runId: 2, teamName: 'Other Team', status: 'DRAFT' })], total: 1 },
      }),
    });
    render(<CertificationDashboardPage />);

    const waiting = screen.getByRole('table', { name: 'Waiting for review' });
    expect(within(waiting).getByText('Waiting Team')).toBeTruthy();
    expect(within(waiting).getByRole('columnheader', { name: 'Waiting' })).toBeTruthy();

    const others = screen.getByRole('table', { name: 'Runs in flight or rejected' });
    expect(within(others).getByText('Other Team')).toBeTruthy();
    expect(within(others).getByRole('columnheader', { name: 'Last updated' })).toBeTruthy();
  });

  it('says nothing is waiting for review when waiting.total is 0', () => {
    setup({ data: dashboard() });
    render(<CertificationDashboardPage />);
    expect(screen.getByText('Nothing is waiting for review')).toBeTruthy();
  });

  it('shows the "Accurate as of page load" line', () => {
    setup({ data: dashboard() });
    render(<CertificationDashboardPage />);
    expect(screen.getByText(/Accurate as of page load/)).toBeTruthy();
  });
});
