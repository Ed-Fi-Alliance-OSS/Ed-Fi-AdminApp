import { fireEvent, render, screen } from '@testing-library/react';
import { useParams } from 'react-router';
import { MyProductsPage } from './MyProductsPage';
import { useCanSeeCertification } from './useCanSeeCertification';

jest.mock('react-router', () => ({
  useParams: jest.fn(),
}));

jest.mock('./useCanSeeCertification', () => ({
  useCanSeeCertification: jest.fn(),
}));

jest.mock('@edanalytics/common-ui', () => ({
  Icons: { Plus: () => null },
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
  RequestCertificationModal: (p: { teamId: number; isOpen: boolean; onClose: () => void }) =>
    p.isOpen ? (
      <div data-testid="request-modal" data-team={p.teamId}>
        <button onClick={p.onClose}>close popup</button>
      </div>
    ) : null,
}));

const mockUseCanSee = useCanSeeCertification as jest.Mock;

describe('MyProductsPage', () => {
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ asId: '7' });
  });

  it('renders My products with the Request New Certification button when allowed', () => {
    mockUseCanSee.mockReturnValue({ canSee: true, isLoading: false, error: null });
    render(<MyProductsPage />);
    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request New Certification' })).toBeTruthy();
    expect(screen.queryByTestId('request-modal')).toBeNull();
    expect(mockUseCanSee).toHaveBeenCalledWith(7);
  });

  it('opens the popup for the team, and closes it again', () => {
    mockUseCanSee.mockReturnValue({ canSee: true, isLoading: false, error: null });
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
});
