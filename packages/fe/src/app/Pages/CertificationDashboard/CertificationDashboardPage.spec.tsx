import 'reflect-metadata';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { usePickUpCertificationRun } from '../CertificationReview/useCertificationReview';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { CertificationDashboardPage } from './CertificationDashboardPage';
import { useCertificationDashboard } from './useCertificationDashboard';

jest.mock('@tanstack/react-query', () => ({ useQueryClient: jest.fn(() => ({})) }));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(),
  usePrivilegeCacheForConfig: jest.fn(),
}));

jest.mock('./useCertificationDashboard', () => ({ useCertificationDashboard: jest.fn() }));
jest.mock('../CertificationReview/useCertificationReview', () => ({
  usePickUpCertificationRun: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));

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
const mockPickUp = usePickUpCertificationRun as jest.Mock;
const mockMutateAsync = jest.fn();

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

const setup = (
  query: Record<string, unknown>,
  { canRead = true, canReview = false, cacheLoading = false } = {},
) => {
  mockCache.mockReturnValue([{ isLoading: cacheLoading }]);
  mockAuthorize.mockImplementation(({ config }: { config: { privilege: string } }) =>
    config.privilege === 'certification:review' ? canReview : canRead,
  );
  mockMutateAsync.mockResolvedValue({});
  mockPickUp.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
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

const renderPage = () => render(<CertificationDashboardPage />);

describe('CertificationDashboardPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a spinner while the privilege cache loads', () => {
    setup({}, { canRead: false, cacheLoading: true });
    expect(() => renderPage()).not.toThrow();
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('Not allowed')).toBeNull();
  });

  it('rethrows a failed privilege cache request instead of "Not allowed" or a spinner', () => {
    setup({}, { canRead: false });
    mockCache.mockReturnValue([{ isLoading: false, error: new Error('Auth cache failed') }]);
    quiet(() => expect(() => renderPage()).toThrow('Auth cache failed'));
  });

  it('throws "Not allowed" without certification:read', () => {
    setup({}, { canRead: false });
    quiet(() => expect(() => renderPage()).toThrow('Not allowed'));
    expect(mockHook).toHaveBeenCalledWith(false);
  });

  it('rethrows a failed dashboard request instead of "Not allowed"', () => {
    setup({ error: new Error('Request failed with status code 500') });
    quiet(() => expect(() => renderPage()).toThrow('Request failed with status code 500'));
  });

  it('shows a spinner while the dashboard loads', () => {
    setup({ isLoading: true });
    renderPage();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the four cards with the ticket labels and counts', () => {
    setup({ data: dashboard() });
    renderPage();
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
    renderPage();

    const waiting = screen.getByRole('table', { name: 'Waiting for review' });
    expect(within(waiting).getByText('Waiting Team')).toBeTruthy();
    expect(within(waiting).getByRole('columnheader', { name: 'Waiting' })).toBeTruthy();

    const others = screen.getByRole('table', { name: 'Runs in flight or rejected' });
    expect(within(others).getByText('Other Team')).toBeTruthy();
    expect(within(others).getByRole('columnheader', { name: 'Last updated' })).toBeTruthy();
  });

  it('says nothing is waiting for review when waiting.total is 0', () => {
    setup({ data: dashboard() });
    renderPage();
    expect(screen.getByText('Nothing is waiting for review')).toBeTruthy();
  });

  it('shows the "Accurate as of page load" line', () => {
    setup({ data: dashboard() });
    renderPage();
    expect(screen.getByText(/Accurate as of page load/)).toBeTruthy();
  });

  describe('review actions', () => {
    const waitingData = () =>
      dashboard({
        waiting: {
          rows: [
            run({ runId: 1, teamName: 'Ready Team', status: 'READY_FOR_REVIEW' }),
            run({ runId: 2, teamName: 'Changes Team', status: 'READY_FOR_REVIEW_WITH_CHANGES' }),
            run({ runId: 3, teamName: 'Review Team', status: 'IN_REVIEW' }),
          ],
          total: 3,
        },
        others: { rows: [run({ runId: 4, teamName: 'Other Team', status: 'DRAFT' })], total: 1 },
      });

    it('shows Pick up for queued runs and Continue for in-review runs', () => {
      setup({ data: waitingData() }, { canReview: true });
      renderPage();
      const waiting = screen.getByRole('table', { name: 'Waiting for review' });
      expect(within(waiting).getByRole('columnheader', { name: 'Action' })).toBeTruthy();
      expect(within(waiting).getAllByRole('button', { name: 'Pick up' })).toHaveLength(2);
      const link = within(waiting).getByRole('link', { name: 'Continue' });
      expect(link.getAttribute('href')).toBe('/certification/runs/3/review');
    });

    it('has no Action column on the others card', () => {
      setup({ data: waitingData() }, { canReview: true });
      renderPage();
      const others = screen.getByRole('table', { name: 'Runs in flight or rejected' });
      expect(within(others).queryByRole('columnheader', { name: 'Action' })).toBeNull();
    });

    it('has no Action column without certification:review', () => {
      setup({ data: waitingData() }, { canReview: false });
      renderPage();
      expect(screen.queryByRole('columnheader', { name: 'Action' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pick up' })).toBeNull();
    });

    it('picks up a run and navigates to its review page', async () => {
      setup({ data: waitingData() }, { canReview: true });
      renderPage();
      fireEvent.click(screen.getAllByRole('button', { name: 'Pick up' })[0]);
      await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ runId: 1 }));
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('/certification/runs/1/review'),
      );
    });

    it('toasts and stays put on a 409', async () => {
      setup({ data: waitingData() }, { canReview: true });
      mockMutateAsync.mockRejectedValue({ statusCode: 409 });
      renderPage();
      fireEvent.click(screen.getAllByRole('button', { name: 'Pick up' })[0]);
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Someone already picked up this run.',
            status: 'warning',
          }),
        ),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('toasts the error message on other failures', async () => {
      setup({ data: waitingData() }, { canReview: true });
      mockMutateAsync.mockRejectedValue({ statusCode: 500, message: 'Boom' });
      renderPage();
      fireEvent.click(screen.getAllByRole('button', { name: 'Pick up' })[0]);
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Boom', status: 'error' }),
        ),
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
