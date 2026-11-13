import 'reflect-metadata';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CertificationScenariosPage } from './CertificationScenariosPage';
import { useCertificationSelection } from './useCertificationSelection';
import { useCertificationAuth } from './CertificationAuthContext';
import { useCertificationCatalog } from './useCertificationCatalog';
import { useCertificationRun } from './useCertificationRun';
import { useCertificationScenarioStatuses } from './useCertificationScenarioStatuses';

const mockNavigate = jest.fn();
// The run comes from the address: /as/:asId/certification/runs/:runId.
let mockParams: { asId: string; runId: string };
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));
jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
jest.mock('../../helpers', () => ({
  getOdsTerminology: (version: string | undefined) => ({
    singular: version === 'v3' ? 'Data Store' : 'ODS',
  }),
  useNavContext: jest.fn(),
}));
jest.mock('./useCertificationSelection', () => ({ useCertificationSelection: jest.fn() }));
jest.mock('./CertificationAuthContext', () => ({
  ...jest.requireActual('./CertificationAuthContext'),
  useCertificationAuth: jest.fn(),
}));
jest.mock('./useCertificationCatalog', () => ({ useCertificationCatalog: jest.fn() }));
jest.mock('./useCertificationRun', () => ({
  useCertificationRun: jest.fn(),
  toRunId: (value: string | undefined) => Number(value) || undefined,
}));
jest.mock('./useCertificationScenarioStatuses', () => ({
  useCertificationScenarioStatuses: jest.fn(),
}));
jest.mock('./CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: (p: { teamId: number; edfiTenantId?: number; odsId?: number }) => (
    <div
      data-testid="auth-form"
      data-team={p.teamId}
      data-tenant={p.edfiTenantId}
      data-ods={p.odsId}
    />
  ),
}));

const catalogDomains = [
  {
    domainId: 17,
    catalogVersionId: 2,
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
      { scenarioId: 51, domainId: 17, name: 'CalendarDates', displayName: null, displayOrder: 7 },
    ],
  },
  {
    domainId: 18,
    catalogVersionId: 2,
    name: 'Staff',
    displayName: 'Staff',
    displayOrder: 3,
    scenarios: [
      { scenarioId: 60, domainId: 18, name: 'Staffs', displayName: 'Staffs', displayOrder: 1 },
    ],
  },
];
const loadedCatalog = {
  sbEnvironment: { id: 1, version: 'v3' },
  dataStandardVersion: 'v5',
  isSupported: true,
  catalogVersion: {
    catalogVersionId: 2,
    artifactVersion: 'v2.1.0',
    dataStandardVersion: 'v5',
    isActive: true,
  },
  domains: catalogDomains,
  isPending: false,
};
const draftRun = {
  runId: 7,
  sbEnvironmentId: 1,
  edfiTenantId: 10,
  odsId: 5,
  environmentName: 'Env One',
  tenantName: 'Tenant One',
  dataStoreName: 'EdFi_Ods_255901',
  certificationModel: 'SIS',
  status: 'DRAFT',
  canExecuteSteps: true,
  dataStandardVersion: 'v5',
};

const refetchStatuses = jest.fn();
const loadedStatuses = (overrides: object = {}) => ({
  statusByScenarioId: {},
  run: { runId: 7, status: 'DRAFT', canExecuteSteps: true },
  canExecuteSteps: true,
  isUnknown: false,
  isLoading: false,
  isError: false,
  isStale: false,
  refetch: refetchStatuses,
  ...overrides,
});
const lastStatusesArgs = () => (useCertificationScenarioStatuses as jest.Mock).mock.calls.at(-1)[0];
const signedOut = (clearAuth = jest.fn()) =>
  (useCertificationAuth as jest.Mock).mockReturnValue({
    auth: null,
    setAuth: jest.fn(),
    clearAuth,
  });
const signedIn = (odsId = 5) =>
  (useCertificationAuth as jest.Mock).mockReturnValue({
    auth: {
      token: 't',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      oauthUrl: 'o',
      resourceBaseUrl: 'r',
      edfiTenantId: 10,
      odsId,
    },
    setAuth: jest.fn(),
    clearAuth: jest.fn(),
  });
const openButtons = () =>
  screen.getAllByRole('button', { name: 'Open Scenario' }) as HTMLButtonElement[];
const rowFor = (scenarioName: string) =>
  screen.getByRole('row', { name: new RegExp(scenarioName) });

describe('CertificationScenariosPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockParams = { asId: '2', runId: '7' };
    signedOut();
    (useCertificationRun as jest.Mock).mockReturnValue({ run: draftRun, isPending: false });
    (useCertificationSelection as jest.Mock).mockReturnValue({
      scenarioId: undefined,
      toSearch: (e: { scenarioId?: number } = {}) => `?scenarioId=${e.scenarioId}`,
    });
    (useCertificationCatalog as jest.Mock).mockReturnValue(loadedCatalog);
    (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(loadedStatuses());
  });

  describe('the run', () => {
    it("loads the run from the address and the catalog of the run's environment", () => {
      render(<CertificationScenariosPage />);

      expect(useCertificationRun).toHaveBeenCalledWith(2, 7);
      expect(useCertificationCatalog).toHaveBeenCalledWith({
        teamId: 2,
        sbEnvironmentId: 1,
        edfiTenantId: 10,
      });
    });

    it("shows the run's data store and Certification Model", () => {
      render(<CertificationScenariosPage />);

      const summary = within(screen.getByRole('group', { name: 'Certification run' }));
      expect(summary.getByText('Environment').nextSibling?.textContent).toBe('Env One');
      expect(summary.getByText('Tenant').nextSibling?.textContent).toBe('Tenant One');
      expect(summary.getByText('Data Store').nextSibling?.textContent).toBe('EdFi_Ods_255901');
      expect(summary.getByText('Certification Model').nextSibling?.textContent).toBe('SIS');
    });

    it('has no tenant or data store to choose: the run fixes them', () => {
      render(<CertificationScenariosPage />);

      const selects = screen
        .getAllByRole('combobox')
        .map((el) => el.getAttribute('aria-label') ?? el.id);
      expect(screen.getAllByRole('combobox')).toHaveLength(1);
      expect(screen.getByRole('combobox', { name: 'Domain Filter' })).toBeTruthy();
      expect(selects).toHaveLength(1);
    });

    it('shows a loading state, not an empty page, until the run loads', () => {
      (useCertificationRun as jest.Mock).mockReturnValue({ run: undefined, isPending: true });
      (useCertificationCatalog as jest.Mock).mockReturnValue({
        ...loadedCatalog,
        sbEnvironment: undefined,
        catalogVersion: undefined,
        domains: [],
        isPending: true,
      });
      render(<CertificationScenariosPage />);

      expect(screen.getByText('Loading...')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
      expect(useCertificationCatalog).toHaveBeenCalledWith({
        teamId: 2,
        sbEnvironmentId: undefined,
        edfiTenantId: undefined,
      });
    });

    it('says the run was not found when the address has no valid run ID', () => {
      mockParams = { asId: '2', runId: 'abc' };
      (useCertificationRun as jest.Mock).mockReturnValue({ run: undefined, isPending: false });
      render(<CertificationScenariosPage />);

      expect(useCertificationRun).toHaveBeenCalledWith(2, undefined);
      expect(screen.getByRole('alert').textContent).toContain(
        "This certification run wasn't found.",
      );
      fireEvent.click(screen.getByRole('button', { name: 'Back to My products' }));
      expect(mockNavigate).toHaveBeenCalledWith('/as/2/my-products');
    });

    it('goes back to My products and drops the token', () => {
      const clearAuth = jest.fn();
      signedOut(clearAuth);
      render(<CertificationScenariosPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Back to My products' }));

      expect(clearAuth).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/as/2/my-products');
    });
  });

  describe('the catalog', () => {
    it('shows the data standard version and lists the catalog domains and scenarios', () => {
      render(<CertificationScenariosPage />);
      expect(screen.getByText('Certification 2.1.0')).toBeTruthy();
      expect(screen.getByText('Data Standard v5')).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Education Organization Calendar' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Staff' })).toBeTruthy();
      expect(screen.getByRole('cell', { name: 'Calendars' })).toBeTruthy();
      // Falls back to the name when there is no display name.
      expect(screen.getByRole('cell', { name: 'CalendarDates' })).toBeTruthy();
      expect(screen.getByRole('cell', { name: 'Staffs' })).toBeTruthy();
    });

    it('filters the scenarios by the selected domain', () => {
      render(<CertificationScenariosPage />);
      fireEvent.change(screen.getByRole('combobox', { name: 'Domain Filter' }), {
        target: { value: '18' },
      });
      expect(screen.queryByRole('cell', { name: 'Calendars' })).toBeNull();
      expect(screen.getByRole('cell', { name: 'Staffs' })).toBeTruthy();
    });

    it('warns when no catalog matches the data standard', () => {
      (useCertificationCatalog as jest.Mock).mockReturnValue({
        ...loadedCatalog,
        dataStandardVersion: 'v6',
        catalogVersion: undefined,
        domains: [],
      });
      render(<CertificationScenariosPage />);
      expect(
        screen.getByText('No certification catalog is available for data standard v6.'),
      ).toBeTruthy();
      expect(
        (screen.getByRole('combobox', { name: 'Domain Filter' }) as HTMLSelectElement).disabled,
      ).toBe(true);
      expect(screen.getByText('No scenarios found for the current filters.')).toBeTruthy();
    });

    it('shows a loading message for the version while the catalog loads', () => {
      (useCertificationCatalog as jest.Mock).mockReturnValue({
        ...loadedCatalog,
        catalogVersion: undefined,
        domains: [],
        isPending: true,
      });
      render(<CertificationScenariosPage />);
      expect(screen.getByText('Loading certification version...')).toBeTruthy();
      expect(screen.queryByText(/No certification catalog/)).toBeNull();
    });

    it('shows only a warning and the way back when the environment does not support certification', () => {
      (useCertificationCatalog as jest.Mock).mockReturnValue({
        ...loadedCatalog,
        unsupportedMessage: 'Certification requires Ed-Fi Data Standard 5.0.0 or later.',
        catalogVersion: undefined,
        domains: [],
      });
      render(<CertificationScenariosPage />);

      expect(screen.getByRole('alert').textContent).toBe(
        'Certification requires Ed-Fi Data Standard 5.0.0 or later.',
      );
      expect(screen.queryByTestId('auth-form')).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.getByRole('button', { name: 'Back to My products' })).toBeTruthy();
    });

    it('spans the empty-state row across all four columns', () => {
      (useCertificationCatalog as jest.Mock).mockReturnValue({ ...loadedCatalog, domains: [] });
      render(<CertificationScenariosPage />);
      expect(
        screen
          .getByText('No scenarios found for the current filters.')
          .closest('td')
          ?.getAttribute('colspan'),
      ).toBe('4');
    });
  });

  describe('scenario statuses', () => {
    it("reads the run's statuses without needing a login", () => {
      render(<CertificationScenariosPage />);

      expect(lastStatusesArgs()).toEqual({ teamId: 2, edfiTenantId: 10, runId: 7, enabled: true });
    });

    it('does not read statuses when no catalog matches the data standard', () => {
      (useCertificationCatalog as jest.Mock).mockReturnValue({
        ...loadedCatalog,
        catalogVersion: undefined,
        domains: [],
      });
      render(<CertificationScenariosPage />);

      expect(lastStatusesArgs()).toMatchObject({ enabled: false });
    });

    it('shows a Status column between Scenario and Action', () => {
      render(<CertificationScenariosPage />);
      const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
      expect(headers).toEqual(['Domain', 'Scenario', 'Status', 'Action']);
    });

    it('shows Successful, Failed and Not executed for each scenario from the statuses hook', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        // Scenario 60 (Staffs) is absent from the loaded response.
        loadedStatuses({ statusByScenarioId: { 52: 'completed', 51: 'failed' } }),
      );
      render(<CertificationScenariosPage />);

      expect(within(rowFor('Calendars')).getByText('Successful')).toBeTruthy();
      expect(within(rowFor('CalendarDates')).getByText('Failed')).toBeTruthy();
      expect(within(rowFor('Staffs')).getByText('Not executed')).toBeTruthy();
    });

    it('shows In progress for a scenario with an in-progress saved status', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ statusByScenarioId: { 52: 'inprogress' } }),
      );
      render(<CertificationScenariosPage />);

      expect(within(rowFor('Calendars')).getByText('In progress')).toBeTruthy();
    });

    it('shows an unknown saved status as Failed', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ statusByScenarioId: { 52: 'bogus' } }),
      );
      render(<CertificationScenariosPage />);

      expect(within(rowFor('Calendars')).getByText('Failed')).toBeTruthy();
    });

    it('shows "—", not Not executed, for every row while the statuses are unknown', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ isUnknown: true }),
      );
      render(<CertificationScenariosPage />);

      for (const name of ['Calendars', 'CalendarDates', 'Staffs']) {
        expect(within(rowFor(name)).getByText('—')).toBeTruthy();
        expect(within(rowFor(name)).queryByText('Not executed')).toBeNull();
      }
    });

    it('shows one loading notice, not a spinner per row, while statuses load', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ isUnknown: true, isLoading: true }),
      );
      render(<CertificationScenariosPage />);

      expect(screen.getAllByText('Loading scenario statuses...')).toHaveLength(1);
      expect(within(rowFor('Calendars')).queryByRole('progressbar')).toBeNull();
    });

    it('keeps the Open Scenario buttons and offers Retry when statuses fail to load', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ isUnknown: true, isError: true }),
      );
      render(<CertificationScenariosPage />);

      expect(screen.getByText("We couldn't load the scenario statuses.")).toBeTruthy();
      expect(openButtons()).toHaveLength(3);
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(refetchStatuses).toHaveBeenCalled();
    });

    it('warns that statuses may be out of date when a refresh fails, keeping the old ones', () => {
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({ statusByScenarioId: { 52: 'completed' }, isError: true, isStale: true }),
      );
      render(<CertificationScenariosPage />);

      expect(screen.getByText(/may be out of date/)).toBeTruthy();
      expect(within(rowFor('Calendars')).getByText('Successful')).toBeTruthy();
    });
  });

  describe('credentials and Open Scenario', () => {
    it("asks for the credentials of the run's data store", () => {
      render(<CertificationScenariosPage />);

      expect(screen.getByTestId('auth-form').dataset).toMatchObject({
        team: '2',
        tenant: '10',
        ods: '5',
      });
    });

    it('keeps Open Scenario disabled until the credentials are validated, then opens the steps page', () => {
      const { rerender } = render(<CertificationScenariosPage />);
      expect(openButtons().every((button) => button.disabled)).toBe(true);

      signedIn();
      rerender(<CertificationScenariosPage />);
      fireEvent.click(openButtons()[0]);

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/as/2/certification/runs/7/execution',
        search: '?scenarioId=52',
      });
    });

    it('does not accept credentials validated for another data store', () => {
      signedIn(6);
      render(<CertificationScenariosPage />);

      expect(openButtons().every((button) => button.disabled)).toBe(true);
    });

    it('hides the credentials form and still lets the vendor open a scenario when the run is in review', () => {
      // Auth is null here: nothing needs validating, because no step can run.
      (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
        loadedStatuses({
          run: { runId: 7, status: 'IN_REVIEW', canExecuteSteps: false },
          canExecuteSteps: false,
        }),
      );
      render(<CertificationScenariosPage />);

      expect(screen.queryByTestId('auth-form')).toBeNull();
      expect(openButtons().length).toBeGreaterThan(0);
      expect(openButtons().every((button) => !button.disabled)).toBe(true);
    });

    // The button only opens the steps page, where the vendor can still read the results;
    // running a step is what a run in review blocks, and that page's Execute step handles it.
    it.each([
      ['Draft', 'DRAFT', true],
      ['Ready for review', 'READY_FOR_REVIEW', false],
      ['In review', 'IN_REVIEW', false],
      ['Approved', 'APPROVED', false],
    ])(
      'stay enabled for a signed-in vendor when the run is %s',
      (_label, status, canExecuteSteps) => {
        signedIn();
        (useCertificationScenarioStatuses as jest.Mock).mockReturnValue(
          loadedStatuses({ run: { runId: 7, status, canExecuteSteps }, canExecuteSteps }),
        );
        render(<CertificationScenariosPage />);

        expect(openButtons().length).toBeGreaterThan(0);
        expect(openButtons().every((button) => !button.disabled)).toBe(true);
      },
    );
  });
});
