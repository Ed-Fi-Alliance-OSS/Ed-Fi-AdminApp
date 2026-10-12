import { fireEvent, render, screen } from '@testing-library/react';
import { CertificationPageExecution } from './CertificationPageExecution';
import { useCertificationSelection } from './useCertificationSelection';
import { useCertificationAuth } from './CertificationAuthContext';
import { useCertificationCatalog, useCertificationSteps } from './useCertificationCatalog';

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
jest.mock('./useCertificationCatalog', () => ({
  useCertificationCatalog: jest.fn(),
  useCertificationSteps: jest.fn(),
}));
jest.mock('./CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: () => <div data-testid="auth-form" />,
}));

const firstScenario = { scenarioId: 52 };
const catalog = {
  dataStandardVersion: 'v5',
  catalogVersion: { catalogVersionId: 2 },
  isPending: false,
  areas: [
    {
      areaId: 17,
      name: 'EducationOrganizationCalendar',
      displayName: 'Education Organization Calendar',
      displayOrder: 2,
      scenarios: [
        {
          scenarioId: 52,
          areaId: 17,
          name: 'Calendars',
          displayName: 'Calendars',
          displayOrder: 6,
        },
      ],
    },
  ],
};
const steps = [
  {
    stepId: 189,
    scenarioId: 52,
    stepName: '01 - 1st Calendar is valid',
    displayName: '01 - 1st Calendar is valid',
    stepType: 'CREATE',
    displayOrder: 1,
    parameters: [
      { parameterId: 484, type: 'input', name: 'schoolId', description: 'FIRST SCHOOL ID' },
      { parameterId: 485, type: 'output', name: 'schoolYear', description: null },
    ],
  },
  {
    stepId: 190,
    scenarioId: 52,
    stepName: '02 - 2nd Calendar is valid',
    displayName: null,
    stepType: 'CREATE',
    displayOrder: 2,
    parameters: [],
  },
];
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
    (useCertificationCatalog as jest.Mock).mockReturnValue(catalog);
    (useCertificationSteps as jest.Mock).mockReturnValue({ steps, isPending: false });
  });

  it('shows the area, scenario and steps from the catalog', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: 52,
    });
    render(<CertificationPageExecution />);
    expect(useCertificationSteps).toHaveBeenCalledWith(1, 52);
    expect(screen.getByText('Education Organization Calendar')).toBeTruthy();
    expect(screen.getByText('Calendars')).toBeTruthy();
    expect(screen.getByText('01 - 1st Calendar is valid')).toBeTruthy();
    // Falls back to the step name when there is no display name.
    expect(screen.getByText('02 - 2nd Calendar is valid')).toBeTruthy();
  });

  it('shows every parameter of the validated step', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: 52,
    });
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: validAuth,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    render(<CertificationPageExecution />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Validate' })[0]);
    expect(screen.getByText('Enter Validation Parameters')).toBeTruthy();
    expect(screen.getByLabelText('FIRST SCHOOL ID')).toBeTruthy();
    expect(screen.getByLabelText('schoolYear')).toBeTruthy();
  });

  it.each([
    [true, 'Loading steps...'],
    [false, 'No steps found for this scenario.'],
  ])('with no steps and isPending %s shows %s', (isPending, message) => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: 52,
    });
    (useCertificationSteps as jest.Mock).mockReturnValue({ steps: [], isPending });
    render(<CertificationPageExecution />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('waits for the catalog before redirecting', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: 52,
    });
    (useCertificationCatalog as jest.Mock).mockReturnValue({
      ...catalog,
      areas: [],
      isPending: true,
    });
    render(<CertificationPageExecution />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects when the scenario is not in the catalog', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: 999,
    });
    render(<CertificationPageExecution />);
    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/parent', search: '?edfiTenantId=10' },
      { replace: true },
    );
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
      scenarioId: firstScenario.scenarioId,
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
      scenarioId: firstScenario.scenarioId,
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
      scenarioId: firstScenario.scenarioId,
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
      scenarioId: firstScenario.scenarioId,
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
      scenarioId: firstScenario.scenarioId,
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
