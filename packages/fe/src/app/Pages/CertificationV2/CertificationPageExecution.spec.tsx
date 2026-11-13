import 'reflect-metadata';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CertificationPageExecution } from './CertificationPageExecution';
import { useCertificationSelection } from './useCertificationSelection';
import { useCertificationAuth } from './CertificationAuthContext';
import {
  certificationQueryKeys,
  useCertificationCatalog,
  useCertificationSteps,
} from './useCertificationCatalog';
import { useCertificationRun } from './useCertificationRun';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';
import { useCertificationStepRuns } from './useCertificationStepRuns';
import { useRunCertificationStep } from '../../api-v2/useRunCertificationStep';

const mockNavigate = jest.fn();
// The run comes from the address: /as/:asId/certification/runs/:runId/execution.
let mockParams: { asId: string; runId: string };
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));
jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../../helpers', () => ({ useNavContext: jest.fn() }));
jest.mock('./useCertificationRun', () => ({
  useCertificationRun: jest.fn(),
  toRunId: (value: string | undefined) => Number(value) || undefined,
}));
jest.mock('./useCertificationSelection', () => ({ useCertificationSelection: jest.fn() }));
jest.mock('./CertificationAuthContext', () => ({
  ...jest.requireActual('./CertificationAuthContext'),
  useCertificationAuth: jest.fn(),
}));
jest.mock('./useCertificationCatalog', () => ({
  certificationQueryKeys: {
    all: (teamId: number) => ['certification', teamId],
    stepRuns: (teamId: number, runId: number | undefined, scenarioId: number | undefined) => [
      'certification',
      teamId,
      'step-runs',
      runId,
      scenarioId,
    ],
    scenarioStatuses: (teamId: number, runId: number | undefined) => [
      'certification',
      teamId,
      'scenario-statuses',
      runId,
    ],
  },
  useCertificationCatalog: jest.fn(),
  useCertificationSteps: jest.fn(),
}));
jest.mock('./useCertificationStepRuns', () => ({ useCertificationStepRuns: jest.fn() }));
jest.mock('./useCertificationScenarioStatuses', () => ({
  useCertificationScenarioStatuses: jest.fn(),
}));
jest.mock('./useCertificationStepSnapshot', () => ({
  useCertificationStepSnapshot: () => ({ snapshot: undefined, isPending: false, isError: false }),
}));
jest.mock('../../api-v2/useRunCertificationStep', () => ({ useRunCertificationStep: jest.fn() }));
const mockQueryClient = { setQueryData: jest.fn(), invalidateQueries: jest.fn() };
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('./CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: () => <div data-testid="auth-form" />,
}));

const firstScenario = { scenarioId: 52 };
const catalog = {
  dataStandardVersion: 'v5',
  catalogVersion: { catalogVersionId: 2 },
  isPending: false,
  domains: [
    {
      domainId: 17,
      name: 'EducationOrganizationCalendar',
      displayName: 'Education Organization Calendar',
      displayOrder: 2,
      scenarios: [
        {
          scenarioId: 52,
          domainId: 17,
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
      {
        parameterId: 485,
        type: 'input',
        name: 'beginDate',
        description: 'FIRST BEGIN DATE YYYY-MM-DD',
      },
      {
        parameterId: 486,
        type: 'context',
        name: 'calendarReference',
        description: 'Resolved from Bruno context variable: calendarRef',
      },
    ],
  },
  {
    stepId: 190,
    scenarioId: 52,
    stepName: '02 - 2nd Calendar is valid',
    displayName: null,
    stepType: 'UPDATE',
    displayOrder: 2,
    parameters: [
      {
        parameterId: 487,
        type: 'reference',
        name: 'calendarId',
        description:
          'Resource identifier captured from the CREATE step and provided automatically by the App',
      },
    ],
  },
];
const validAuth = {
  token: 't',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  oauthUrl: 'o',
  resourceBaseUrl: 'r',
  edfiTenantId: 10,
  odsId: 5,
};

const STEP_RUNS_KEY = ['certification', 2, 'step-runs', 7, 52];
const savedFailure = {
  stepId: 189,
  status: 'failed',
  ranAt: '2026-10-15T15:00:00.000Z',
  inputs: { schoolId: '255901', beginDate: '2026-08-01' },
  responseStatus: 500,
  errors: [
    {
      kind: 'exception',
      field: null,
      expected: null,
      observed: 'The API returned HTTP 500 Internal Server Error.',
      message: 'No Calendar found, or multiple records were returned.',
    },
  ],
};
let refetch: jest.Mock;
let runState: {
  mutate: jest.Mock;
  reset: jest.Mock;
  isPending: boolean;
  variables: { stepId: number; runId: number } | undefined;
  error: unknown;
};
const handlers = () => (useRunCertificationStep as jest.Mock).mock.calls.at(-1)[0];
const mockStepRuns = (runsByStepId: Record<number, unknown>, queryKey = STEP_RUNS_KEY) =>
  (useCertificationStepRuns as jest.Mock).mockReturnValue({
    runsByStepId,
    scenarioStatus: null,
    isPending: false,
    refetch,
    queryKey,
  });

/** What the statuses hook says about the run. */
const mockRunState = (canExecuteSteps: boolean, run: object | null | undefined = null) =>
  (useCertificationScenarioStatuses as jest.Mock).mockReturnValue({ run, canExecuteSteps });

/** The run in the address, which fixes the environment, tenant and data store. */
const mockRun = (overrides: object = {}) =>
  (useCertificationRun as jest.Mock).mockReturnValue({
    run: { runId: 7, sbEnvironmentId: 1, edfiTenantId: 10, odsId: 5, ...overrides },
    isPending: false,
  });

/** The vendor moves to another run's address. */
const openRun = (runId: number) => {
  mockParams = { asId: '2', runId: String(runId) };
  mockRun({ runId });
};

describe('CertificationPageExecution', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockParams = { asId: '2', runId: '7' };
    mockRun();
    refetch = jest.fn();
    runState = {
      mutate: jest.fn(),
      reset: jest.fn(),
      isPending: false,
      variables: undefined,
      error: null,
    };
    (useRunCertificationStep as jest.Mock).mockImplementation(() => runState);
    mockStepRuns({});
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: null,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    (useCertificationCatalog as jest.Mock).mockReturnValue(catalog);
    (useCertificationSteps as jest.Mock).mockReturnValue({ steps, isPending: false });
    mockRunState(true, { runId: 7, status: 'DRAFT', canExecuteSteps: true });
  });

  it('shows the domain, scenario and steps from the catalog', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    render(<CertificationPageExecution />);
    expect(useCertificationRun).toHaveBeenCalledWith(2, 7);
    expect(useCertificationCatalog).toHaveBeenCalledWith({
      teamId: 2,
      sbEnvironmentId: 1,
      edfiTenantId: 10,
    });
    expect(useCertificationSteps).toHaveBeenCalledWith({
      teamId: 2,
      edfiTenantId: 10,
      scenarioId: 52,
    });
    expect(screen.getByText('Education Organization Calendar')).toBeTruthy();
    expect(screen.getByText('Calendars')).toBeTruthy();
    expect(screen.getByText('01 - 1st Calendar is valid')).toBeTruthy();
    // Falls back to the step name when there is no display name.
    expect(screen.getByText('02 - 2nd Calendar is valid')).toBeTruthy();
    expect(screen.getByText('Select Open on a row to load its dynamic parameters.')).toBeTruthy();
  });

  const renderAuthenticated = (odsId = 5) => {
    mockRun({ odsId });
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: { ...validAuth, odsId },
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    return render(<CertificationPageExecution />);
  };
  const executeButton = () =>
    screen.getByRole('button', { name: 'Execute step' }) as HTMLButtonElement;

  it('labels the grouping "Domain"', () => {
    renderAuthenticated();
    expect(screen.getByText('Domain')).toBeTruthy();
    expect(screen.queryByText('Group or Area')).toBeNull();
  });

  it("reads the run's status and scenario statuses, keyed by the run", () => {
    renderAuthenticated();
    expect(useCertificationScenarioStatuses).toHaveBeenCalledWith({
      teamId: 2,
      edfiTenantId: 10,
      runId: 7,
      enabled: true,
    });
  });

  it("accepts only credentials validated for the run's data store", () => {
    mockRun({ odsId: 6 });
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: validAuth,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    render(<CertificationPageExecution />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
    expect(executeButton().disabled).toBe(true);
  });

  it("disables Execute step when the run can't take step runs", () => {
    mockRunState(false, { runId: 7, status: 'IN_REVIEW', canExecuteSteps: false });
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
    expect(executeButton().disabled).toBe(true);
  });

  it("keeps Execute step enabled while the run's status is still unknown", () => {
    mockRunState(true, undefined);
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
    expect(executeButton().disabled).toBe(false);
  });

  describe('when the run is in review (AC-649)', () => {
    const IN_REVIEW = { runId: 7, status: 'IN_REVIEW', canExecuteSteps: false };
    const BLOCKED = "Steps can't be executed while this run is in review.";
    const renderSignedOut = () => {
      (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
      render(<CertificationPageExecution />);
    };

    it('hides the credentials form and the expired-session alert', () => {
      mockRunState(false, IN_REVIEW);
      renderSignedOut();
      expect(screen.queryByTestId('auth-form')).toBeNull();
      expect(screen.queryByText(/session has expired/)).toBeNull();
    });

    it('explains below Execute step why steps cannot be executed', () => {
      mockRunState(false, IN_REVIEW);
      renderAuthenticated();
      fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
      expect(executeButton().disabled).toBe(true);
      expect(screen.getByText(BLOCKED)).toBeTruthy();
    });

    it('shows the disclaimer instead of the credentials hint when nobody is signed in', () => {
      mockRunState(false, IN_REVIEW);
      renderSignedOut();
      fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
      expect(screen.getByText(BLOCKED)).toBeTruthy();
      expect(screen.queryByText(/Validate your credentials above/)).toBeNull();
    });

    it('still shows the saved steps so the vendor can review them', () => {
      mockRunState(false, IN_REVIEW);
      renderSignedOut();
      expect(screen.getByText('01 - 1st Calendar is valid')).toBeTruthy();
    });

    it('shows no disclaimer and keeps the credentials form while steps can run', () => {
      mockRunState(true, { runId: 7, status: 'DRAFT', canExecuteSteps: true });
      renderAuthenticated();
      fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
      expect(screen.queryByText(BLOCKED)).toBeNull();
      expect(screen.getByTestId('auth-form')).toBeTruthy();
    });
  });

  it('shows only the input parameters, with readable labels and format hints', () => {
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    expect(screen.getByText('Enter Validation Parameters')).toBeTruthy();
    expect(screen.getByLabelText('First school id')).toBeTruthy();
    expect((screen.getByLabelText('First begin date') as HTMLInputElement).placeholder).toBe(
      'YYYY-MM-DD',
    );
    expect(screen.getByText('Format: YYYY-MM-DD')).toBeTruthy();
    expect(screen.queryByText(/Bruno context variable/)).toBeNull();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('enables Execute step once every input parameter is filled', () => {
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    expect(executeButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('First school id'), { target: { value: '255901' } });
    expect(executeButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('First begin date'), {
      target: { value: '2026-08-15' },
    });
    expect(executeButton().disabled).toBe(false);
  });

  it('asks for nothing on a step whose only parameter the app fills in', () => {
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(executeButton().disabled).toBe(false);
  });

  it('tells the vendor a step without parameters is ready, instead of asking for fields', () => {
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]);

    expect(screen.getByText('Ready to execute')).toBeTruthy();
    expect(
      screen.getByText(
        "This step doesn't need any parameters. Click Execute step when you're ready.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Enter Validation Parameters')).toBeNull();
    expect(screen.queryByText(/Complete the fields below/)).toBeNull();
    expect(screen.queryByText('This step has no parameters to enter.')).toBeNull();
  });

  it('keeps asking for parameters on a step that has them', () => {
    renderAuthenticated();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);

    expect(screen.getByText(/Complete the fields below/)).toBeTruthy();
    expect(screen.queryByText('Ready to execute')).toBeNull();
  });

  it.each([
    [true, 'Loading steps...'],
    [false, 'No steps found for this scenario.'],
  ])('with no steps and isPending %s shows %s', (isPending, message) => {
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    (useCertificationSteps as jest.Mock).mockReturnValue({ steps: [], isPending });
    render(<CertificationPageExecution />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('waits for the catalog before redirecting', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    (useCertificationCatalog as jest.Mock).mockReturnValue({
      ...catalog,
      domains: [],
      isPending: true,
    });
    render(<CertificationPageExecution />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an inline warning instead of redirecting when the environment does not support certification', () => {
    const clearAuth = jest.fn();
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: null,
      setAuth: jest.fn(),
      clearAuth,
    });
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    (useCertificationCatalog as jest.Mock).mockReturnValue({
      dataStandardVersion: 'v4',
      unsupportedMessage: 'Certification requires Ed-Fi Data Standard 5.0.0 or later.',
      catalogVersion: undefined,
      domains: [],
      isPending: false,
    });
    render(<CertificationPageExecution />);

    expect(screen.getByRole('alert').textContent).toBe(
      'Certification requires Ed-Fi Data Standard 5.0.0 or later.',
    );
    expect(useCertificationSteps).toHaveBeenCalledWith({
      teamId: 2,
      edfiTenantId: 10,
      scenarioId: undefined,
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    // The Scenarios page would only repeat the warning, so Cancel goes to My products.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clearAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/as/2/my-products');
  });

  it('redirects when the scenario is not in the catalog', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 999 });
    render(<CertificationPageExecution />);
    expect(mockNavigate).toHaveBeenCalledWith('/as/2/certification/runs/7', { replace: true });
  });

  it("redirects to the run's Scenarios page when the URL has no scenario", () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: undefined });
    render(<CertificationPageExecution />);
    expect(mockNavigate).toHaveBeenCalledWith('/as/2/certification/runs/7', { replace: true });
  });

  it('renders nothing and does not redirect while the run loads', () => {
    (useCertificationRun as jest.Mock).mockReturnValue({ run: undefined, isPending: true });
    (useCertificationSelection as jest.Mock).mockReturnValue({
      scenarioId: firstScenario.scenarioId,
    });
    render(<CertificationPageExecution />);
    expect(screen.queryByTestId('auth-form')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('goes to My products when the address has no valid run ID', () => {
    mockParams = { asId: '2', runId: 'abc' };
    (useCertificationRun as jest.Mock).mockReturnValue({ run: undefined, isPending: false });
    (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
    render(<CertificationPageExecution />);
    expect(mockNavigate).toHaveBeenCalledWith('/as/2/my-products', { replace: true });
  });

  it("Back returns to the run's Scenarios page", () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      scenarioId: firstScenario.scenarioId,
    });
    render(<CertificationPageExecution />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/as/2/certification/runs/7');
  });

  it('after a refresh, keeps the scenario from the URL, asks to validate again and still lets steps be opened', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
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
    const buttons = screen.getAllByRole('button', { name: 'Open' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it.each([
    ['expired', true],
    [null, true],
    ['user', false],
  ])('with clearReason %s the expired alert shown is %s', (clearReason, shown) => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
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
    const buttons = screen.getAllByRole('button', { name: 'Open' });
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('real step runs', () => {
    const select = (index: number) =>
      fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[index]);
    const rowOf = (stepName: string) => screen.getByText(stepName).closest('tr') as HTMLElement;
    const fillStep189 = () => {
      fireEvent.change(screen.getByLabelText('First school id'), { target: { value: '255901' } });
      fireEvent.change(screen.getByLabelText('First begin date'), {
        target: { value: '2026-08-01' },
      });
    };

    it("reads the run's saved results of the scenario", () => {
      renderAuthenticated();
      expect(useCertificationStepRuns).toHaveBeenCalledWith({
        teamId: 2,
        edfiTenantId: 10,
        runId: 7,
        scenarioId: 52,
      });
    });

    it("shows each step's saved status on load", () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();

      expect(within(rowOf('01 - 1st Calendar is valid')).getByText('Failed')).toBeTruthy();
      expect(within(rowOf('02 - 2nd Calendar is valid')).getByText('Not executed')).toBeTruthy();
    });

    it('lays the parameters and the execution result out side by side in one grid', () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);

      let grid: HTMLElement | null = screen.getByText('Execution result');
      while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement;
      expect(grid).not.toBeNull();
      expect(within(grid as HTMLElement).getByText('Enter Validation Parameters')).toBeTruthy();
    });

    it('closes the response details when another step is selected', () => {
      mockStepRuns({ 189: savedFailure, 190: { ...savedFailure, stepId: 190 } });
      renderAuthenticated();
      select(0);
      const toggle = () => screen.getByRole('button', { name: /View response details/ });
      fireEvent.click(toggle());
      expect(toggle().getAttribute('aria-expanded')).toBe('true');

      select(1);

      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('shows the response details below both columns, at full width', () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);

      let grid: HTMLElement | null = screen.getByText('Execution result');
      while (grid && getComputedStyle(grid).display !== 'grid') grid = grid.parentElement;
      const toggle = screen.getByRole('button', { name: /View response details/ });
      expect(grid?.contains(toggle)).toBe(false);
      expect(
        (grid as HTMLElement).compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('shows the saved errors and prefilled inputs when a step is selected', () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);

      expect((screen.getByLabelText('First school id') as HTMLInputElement).value).toBe('255901');
      expect((screen.getByLabelText('First begin date') as HTMLInputElement).value).toBe(
        '2026-08-01',
      );
      expect(
        screen.getByText('No Calendar found, or multiple records were returned.'),
      ).toBeTruthy();
    });

    it('lets a signed-out vendor select a step and see saved results, but not execute', () => {
      mockStepRuns({ 189: savedFailure });
      (useCertificationSelection as jest.Mock).mockReturnValue({ scenarioId: 52 });
      (useCertificationAuth as jest.Mock).mockReturnValue({
        auth: null,
        clearReason: 'expired',
        setAuth: jest.fn(),
        clearAuth: jest.fn(),
      });
      render(<CertificationPageExecution />);
      select(0);

      expect(
        screen.getByText('No Calendar found, or multiple records were returned.'),
      ).toBeTruthy();
      expect(executeButton().disabled).toBe(true);
      expect(
        screen.getByText('Validate your credentials above to execute this step.'),
      ).toBeTruthy();
    });

    it('runs the step with inputs keyed by parameter name and the token', () => {
      renderAuthenticated();
      select(0);
      fillStep189();
      fireEvent.click(executeButton());

      expect(runState.reset).toHaveBeenCalled();
      expect(runState.mutate).toHaveBeenCalledWith({
        teamId: 2,
        edfiTenantId: 10,
        runId: 7,
        stepId: 189,
        scenarioId: 52,
        // No data store in the body: the run fixes it.
        body: {
          token: 't',
          inputs: { schoolId: '255901', beginDate: '2026-08-01' },
        },
      });
    });

    it('shows Running on the row and disables Execute while the run is pending', () => {
      mockStepRuns({ 189: savedFailure });
      runState.isPending = true;
      runState.variables = { stepId: 189, runId: 7 };
      renderAuthenticated();
      select(0);

      expect(within(rowOf('01 - 1st Calendar is valid')).getByText('Running')).toBeTruthy();
      expect(executeButton().disabled).toBe(true);
    });

    it('writes the run response into the saved results and refreshes them', () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);
      fireEvent.click(executeButton());
      handlers().onSuccess(
        {
          stepId: 189,
          status: 'success',
          ranAt: '2026-10-16T10:00:00.000Z',
          scenarioStatus: 'inprogress',
          responseStatus: 200,
          errors: [],
        },
        runState.mutate.mock.calls[0][0],
      );

      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        STEP_RUNS_KEY,
        expect.any(Function),
      );
      const update = mockQueryClient.setQueryData.mock.calls[0][1];
      const otherStep = { ...savedFailure, stepId: 190 };
      expect(update({ scenarioStatus: 'failed', steps: [savedFailure, otherStep] })).toEqual({
        scenarioStatus: 'inprogress',
        steps: [
          {
            stepId: 189,
            status: 'success',
            ranAt: '2026-10-16T10:00:00.000Z',
            inputs: { schoolId: '255901', beginDate: '2026-08-01' },
            responseStatus: 200,
            errors: [],
          },
          otherStep,
        ],
      });
      expect(update(undefined)).toEqual({
        scenarioStatus: 'inprogress',
        steps: [expect.objectContaining({ stepId: 189, status: 'success' })],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: STEP_RUNS_KEY });
    });

    it("also invalidates the run's scenario statuses, which the Scenarios page shows", () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);
      fireEvent.click(executeButton());
      handlers().onSuccess(
        {
          stepId: 189,
          status: 'success',
          ranAt: '2026-10-16T10:00:00.000Z',
          scenarioStatus: 'inprogress',
          errors: [],
        },
        runState.mutate.mock.calls[0][0],
      );

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: certificationQueryKeys.scenarioStatuses(2, 7),
      });
    });

    it('keeps a late mutation result in the run that started it', () => {
      const { rerender } = renderAuthenticated();
      select(0);
      fillStep189();
      fireEvent.click(executeButton());
      const variables = runState.mutate.mock.calls[0][0];
      const nextKey = ['certification', 2, 'step-runs', 8, 52];
      openRun(8);
      mockStepRuns({}, nextKey);
      rerender(<CertificationPageExecution />);

      handlers().onSuccess(
        {
          stepId: 189,
          status: 'success',
          ranAt: 'new-time',
          scenarioStatus: 'completed',
          errors: [],
        },
        variables,
      );

      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        STEP_RUNS_KEY,
        expect.any(Function),
      );
      expect(mockQueryClient.setQueryData).not.toHaveBeenCalledWith(nextKey, expect.any(Function));
    });

    it('clears typed inputs from the previous run when another run is opened', () => {
      const { rerender } = renderAuthenticated();
      select(0);
      fillStep189();
      openRun(8);
      mockStepRuns({});

      rerender(<CertificationPageExecution />);

      expect((screen.getByLabelText('First school id') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('First begin date') as HTMLInputElement).value).toBe('');
    });

    it('closes response details when the same step belongs to a different run', () => {
      mockStepRuns({ 189: savedFailure });
      const { rerender } = renderAuthenticated();
      select(0);
      fireEvent.click(screen.getByRole('button', { name: /View response details/ }));
      openRun(8);

      rerender(<CertificationPageExecution />);

      expect(
        screen.getByRole('button', { name: /View response details/ }).getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('refreshes run status after a 409 so a stale tab becomes read-only', () => {
      const { rerender } = renderAuthenticated();
      select(1);
      expect(executeButton().disabled).toBe(false);

      handlers().onError({
        statusCode: 409,
        message: 'This certification run is locked for review.',
      });

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: certificationQueryKeys.scenarioStatuses(2, 7),
      });
      mockRunState(false, { runId: 7, status: 'IN_REVIEW', canExecuteSteps: false });
      rerender(<CertificationPageExecution />);

      expect(executeButton().disabled).toBe(true);
      expect(screen.queryByTestId('auth-form')).toBeNull();
    });

    it('shows the API message when the run is rejected', () => {
      const message =
        'Another step of this scenario is running. Wait for it to finish, then try again.';
      runState.error = { statusCode: 409, message };
      runState.variables = { stepId: 189, runId: 7 };
      renderAuthenticated();
      select(0);

      expect(screen.getByText(message)).toBeTruthy();
    });

    it('reloads the catalog when the step is no longer in it', () => {
      renderAuthenticated();
      select(1);
      fireEvent.click(executeButton());
      handlers().onError({ statusCode: 404, message: 'Not Found' });

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: certificationQueryKeys.all(2),
      });
      expect(refetch).not.toHaveBeenCalled();
    });

    it('does not mark the step failed when the result is unknown, and refetches', () => {
      runState.error = '<html>504 Gateway Time-out</html>';
      runState.variables = { stepId: 190, runId: 7 };
      renderAuthenticated();
      select(1);
      fireEvent.click(executeButton());
      handlers().onError(runState.error);

      expect(refetch).toHaveBeenCalled();
      expect(within(rowOf('02 - 2nd Calendar is valid')).getByText('Not executed')).toBeTruthy();
      expect(
        screen.getByText(
          "We couldn't confirm this run's result. It may still have been saved, so the step statuses have been refreshed.",
        ),
      ).toBeTruthy();
    });

    it("shows a run's error only on the step it ran", () => {
      const message =
        'Another step of this scenario is running. Wait for it to finish, then try again.';
      runState.error = { statusCode: 409, message };
      runState.variables = { stepId: 189, runId: 7 };
      renderAuthenticated();
      select(1);

      expect(screen.queryByText(message)).toBeNull();
    });

    it('keeps a running step running when the vendor opens another step', () => {
      runState.isPending = true;
      runState.variables = { stepId: 189, runId: 7 };
      renderAuthenticated();
      select(0);
      select(1);

      expect(runState.reset).not.toHaveBeenCalled();
      expect(within(rowOf('01 - 1st Calendar is valid')).getByText('Running')).toBeTruthy();
      expect(executeButton().disabled).toBe(true);
    });

    it("keeps a vendor's edits when switching steps and back", () => {
      mockStepRuns({ 189: savedFailure });
      renderAuthenticated();
      select(0);
      fireEvent.change(screen.getByLabelText('First school id'), { target: { value: '999' } });
      select(1);
      select(0);

      expect((screen.getByLabelText('First school id') as HTMLInputElement).value).toBe('999');
      expect((screen.getByLabelText('First begin date') as HTMLInputElement).value).toBe(
        '2026-08-01',
      );
    });

    it('has no leftover simulated results', () => {
      renderAuthenticated();
      select(0);
      expect(screen.queryByText(/simulated/i)).toBeNull();
      expect(screen.queryByText(/alternateDayName/)).toBeNull();
    });
  });
});
