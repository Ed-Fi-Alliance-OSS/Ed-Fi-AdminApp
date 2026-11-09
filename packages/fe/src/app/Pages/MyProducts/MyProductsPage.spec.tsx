import { render, screen } from '@testing-library/react';
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
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const mockUseCanSee = useCanSeeCertification as jest.Mock;

describe('MyProductsPage', () => {
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ asId: '7' });
  });

  it('renders the empty My products page when allowed', () => {
    mockUseCanSee.mockReturnValue({ canSee: true, isLoading: false });
    render(<MyProductsPage />);
    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    expect(mockUseCanSee).toHaveBeenCalledWith(7);
  });

  it('throws "Not allowed" when the user can\'t see certification', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: false });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<MyProductsPage />)).toThrow('Not allowed');
    spy.mockRestore();
  });

  it('shows a spinner and does not throw while loading', () => {
    mockUseCanSee.mockReturnValue({ canSee: false, isLoading: true });
    expect(() => render(<MyProductsPage />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'My products' })).toBeTruthy();
    // Chakra's Spinner renders a visually hidden "Loading..." label.
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
