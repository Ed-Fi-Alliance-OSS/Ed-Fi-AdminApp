import { fireEvent, render, screen } from '@testing-library/react';
import { CertificationPageExecution } from './CertificationPageExecution';
import { useCertificationSelection } from './useCertificationSelection';
import { useCertificationAuth } from './CertificationAuthContext';
import certificationScenarios from './certification-scenarios.json';

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sbEnvironmentId: '1' }),
}));
jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('../../helpers', () => ({ useNavToParent: () => '/parent' }));
jest.mock('../../../config/config', () => ({ config: { showRequestCertification: true } }));
jest.mock('./useCertificationSelection', () => ({ useCertificationSelection: jest.fn() }));
jest.mock('./CertificationAuthContext', () => ({
  ...jest.requireActual('./CertificationAuthContext'),
  useCertificationAuth: jest.fn(),
}));
jest.mock('./CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: () => <div data-testid="auth-form" />,
}));

const firstScenario = (certificationScenarios as Array<{ id: number; scenariosName?: string }>)[0];
const validAuth = {
  token: 't',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  oauthUrl: 'o',
  resourceBaseUrl: 'r',
  edfiTenantId: 10,
  odsId: undefined,
};

describe('CertificationPageExecution', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: null,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
  });

  it('redirects to the request page when the URL has no scenario', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: undefined,
    });
    render(<CertificationPageExecution />);
    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/parent', search: '?edfiTenantId=10' },
      { replace: true },
    );
  });

  it('renders nothing and redirects when the tenant is missing', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: undefined,
      odsId: undefined,
      scenarioId: firstScenario.id,
    });
    render(<CertificationPageExecution />);
    expect(screen.queryByTestId('auth-form')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/parent', search: '' },
      { replace: true },
    );
  });

  it('Back keeps the tenant and ODS in the query string but drops the scenario', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: 5,
      scenarioId: firstScenario.id,
    });
    render(<CertificationPageExecution />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/parent',
      search: '?edfiTenantId=10&odsId=5',
    });
  });

  it('after a refresh, keeps the scenario from the URL and asks to validate again', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: firstScenario.id,
    });
    render(<CertificationPageExecution />);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Your session has expired. Please validate your credentials again to continue.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('auth-form')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Validate' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it.each([
    ['expired', true],
    [null, true],
    ['user', false],
  ])('with clearReason %s the expired alert shown is %s', (clearReason, shown) => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: firstScenario.id,
    });
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: null,
      clearReason,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    render(<CertificationPageExecution />);
    expect(screen.getByTestId('auth-form')).toBeTruthy();
    expect(
      !!screen.queryByText(
        'Your session has expired. Please validate your credentials again to continue.',
      ),
    ).toBe(shown);
  });

  it('hides the alert, keeps the status form and enables Validate when the tab already holds a valid token', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: firstScenario.id,
    });
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: validAuth,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    render(<CertificationPageExecution />);
    expect(
      screen.queryByText(
        'Your session has expired. Please validate your credentials again to continue.',
      ),
    ).toBeNull();
    expect(screen.getByTestId('auth-form')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Validate' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
