import { fireEvent, render, screen } from '@testing-library/react';
import { useParams } from 'react-router';
import { MyProductsPage } from './MyProductsPage';
import { useCanSeeCertification } from './useCanSeeCertification';
import { useTeamCertificationDashboard } from './useTeamCertificationDashboard';

jest.mock('react-router', () => ({
  useParams: jest.fn(),
}));

jest.mock('./useCanSeeCertification', () => ({
  useCanSeeCertification: jest.fn(),
}));

jest.mock('./useTeamCertificationDashboard', () => ({
  useTeamCertificationDashboard: jest.fn(),
}));

jest.mock('./TeamDashboardSummaryCards', () => ({
  TeamDashboardSummaryCards: ({ counts }: { counts: unknown }) => (
    <div data-testid="summary" data-counts={JSON.stringify(counts)} />
  ),
}));

jest.mock('./DataStoreCard', () => ({
  DataStoreCard: ({ dataStore }: { dataStore: { odsId: number } }) => (
    <div data-testid="data-store-card">{dataStore.odsId}</div>
  ),
}));

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { Plus: () => null },
  PageContentCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  ContentSection: ({ heading, children }: { heading: string; children: React.ReactNode }) => (
    <section>
      <h2>{heading}</h2>
      {children}
    </section>
  ),
  // Renders each action as a plain button, the way the real action bar does.
  PageActions: ({
    actions,
  }: {
    actions: Record<string, { text: string; title?: string; onClick: () => void }>;
  }) => (
    <>
      {Object.entries(actions).map(([key, action]) => (
        <button key={key} title={action.title} onClick={action.onClick}>
          {action.text}
        </button>
      ))}
    </>
  ),
  PageTemplate: ({
    title,
    actions,
    children,
  }: {
    title?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {actions}
      {children}
    </div>
  ),
}));

jest.mock('./RequestCertificationModal', () => ({
  // Rendered whenever the page mounts it, so a closed popup that stays mounted would show up.
  RequestCertificationModal: (p: { teamId: number; onClose: () => void }) => (
    <div data-testid="request-modal" data-team={p.teamId}>
      <button onClick={p.onClose}>close popup</button>
    </div>
  ),
}));

const mockUseCanSee = useCanSeeCertification as jest.Mock;
const mockUseDashboard = useTeamCertificationDashboard as jest.Mock;
const counts = { waitingOnUs: 1, readyForReview: 2, executingNow: 3, certified: 4 };
const dataStores = [{ odsId: 5 }, { odsId: 6 }];

describe('MyProductsPage', () => {
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ asId: '7' });
    mockUseDashboard.mockReturnValue({ data: { counts, dataStores }, isLoading: false, error: null });
  });

  it('renders My products with the Request New Certification button when allowed', () => {
    mockUseCanSee.mockReturnValue({ canSee: true, canRun: true, isLoading: false, error: null });
    render(<MyProductsPage />);
    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request New Certification' })).toBeTruthy();
    expect(screen.queryByTestId('request-modal')).toBeNull();
    expect(mockUseCanSee).toHaveBeenCalledWith(7);
  });

  it("offers no button, and says why, to a user who can see certification but can't run it", () => {
    mockUseCanSee.mockReturnValue({ canSee: true, canRun: false, isLoading: false, error: null });
    render(<MyProductsPage />);

    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Request New Certification' })).toBeNull();
    expect(screen.getByText(/can't start a certification run/)).toBeTruthy();
  });

  it('opens the popup for the team, and closes it again', () => {
    mockUseCanSee.mockReturnValue({ canSee: true, canRun: true, isLoading: false, error: null });
    render(<MyProductsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Request New Certification' }));
    expect(screen.getByTestId('request-modal').dataset.team).toBe('7');

    fireEvent.click(screen.getByRole('button', { name: 'close popup' }));
    expect(screen.queryByTestId('request-modal')).toBeNull();
  });

  it('offers no button while the access check is loading', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: true, error: null });
    render(<MyProductsPage />);
    expect(screen.queryByRole('button', { name: 'Request New Certification' })).toBeNull();
  });

  it('throws "Not allowed" when the user can\'t see certification', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: false, error: null });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<MyProductsPage />)).toThrow('Not allowed');
    spy.mockRestore();
  });

  it('throws the access-check error, not "Not allowed", when the check fails', () => {
    mockUseCanSee.mockReturnValue({
      canSee: false,
      isLoading: false,
      error: new Error('Request failed with status code 500'),
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<MyProductsPage />)).toThrow('Request failed with status code 500');
    spy.mockRestore();
  });

  it('shows a spinner and does not throw while loading', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: true, error: null });
    expect(() => render(<MyProductsPage />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    // Chakra's Spinner renders a visually hidden "Loading..." label.
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  describe('dashboard', () => {
    const allowed = { canSee: true, canRun: true, isLoading: false, error: null };

    it('renders the summary cards with the counts and one card per data store', () => {
      mockUseCanSee.mockReturnValue(allowed);
      render(<MyProductsPage />);
      expect(JSON.parse(screen.getByTestId('summary').dataset.counts as string)).toEqual(counts);
      expect(screen.getAllByTestId('data-store-card').map((c) => c.textContent)).toEqual(['5', '6']);
    });

    it('shows grayed summary cards and a hint when there are no data stores', () => {
      mockUseCanSee.mockReturnValue(allowed);
      mockUseDashboard.mockReturnValue({
        data: { counts, dataStores: [] },
        isLoading: false,
        error: null,
      });
      render(<MyProductsPage />);
      expect(screen.getByTestId('summary').dataset.counts).toBe('null');
      expect(screen.queryAllByTestId('data-store-card')).toHaveLength(0);
      expect(screen.getByText(/Request New Certification/, { selector: 'p' })).toBeTruthy();
    });

    it('shows a spinner and no cards while the dashboard loads', () => {
      mockUseCanSee.mockReturnValue(allowed);
      mockUseDashboard.mockReturnValue({ data: undefined, isLoading: true, error: null });
      render(<MyProductsPage />);
      expect(screen.getByText('Loading...')).toBeTruthy();
      expect(screen.queryByTestId('summary')).toBeNull();
    });

    it('throws the dashboard error, not "Not allowed"', () => {
      mockUseCanSee.mockReturnValue(allowed);
      mockUseDashboard.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Request failed with status code 500'),
      });
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(() => render(<MyProductsPage />)).toThrow('Request failed with status code 500');
      spy.mockRestore();
    });

    it('loads the dashboard for the team only when the user can see certification', () => {
      mockUseCanSee.mockReturnValue(allowed);
      render(<MyProductsPage />);
      expect(mockUseDashboard).toHaveBeenCalledWith(7, true);

      mockUseDashboard.mockClear();
      mockUseCanSee.mockReturnValue({ canSee: false, isLoading: true, error: null });
      render(<MyProductsPage />);
      expect(mockUseDashboard).toHaveBeenCalledWith(7, false);
    });
  });
});
