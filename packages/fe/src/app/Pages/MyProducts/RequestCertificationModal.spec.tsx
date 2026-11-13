import 'reflect-metadata';
import { fireEvent, render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useCertificationAuth } from '../CertificationV2/CertificationAuthContext';
import {
  useLatestCertificationRuns,
  useStartCertificationRun,
} from '../CertificationV2/useCertificationRun';
import { RequestCertificationModal } from './RequestCertificationModal';

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({ useNavigate: () => mockNavigate }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@edanalytics/common-ui', () => ({ Icons: { InfoCircle: () => null } }));
jest.mock('../../api', () => ({
  sbEnvironmentQueries: { getAll: (a: object) => ({ key: 'envs', ...a }) },
  edfiTenantQueries: { getAll: (a: object) => ({ key: 'tenants', ...a }) },
  odsQueries: { getAll: (a: object) => ({ key: 'odss', ...a }) },
}));
// The real error-message helper is used; its module's axios client isn't needed here.
jest.mock('../../api-v2/apiClient', () => ({ apiClient: {} }));
jest.mock('../../helpers', () => ({
  getOdsTerminology: (version: string | undefined) => ({
    singular: version === 'v3' ? 'Data Store' : 'ODS',
  }),
  useNavContext: jest.fn(),
}));
jest.mock('../CertificationV2/CertificationAuthContext', () => ({
  ...jest.requireActual('../CertificationV2/CertificationAuthContext'),
  useCertificationAuth: jest.fn(),
}));
jest.mock('../CertificationV2/useCertificationRun', () => ({
  ...jest.requireActual('../CertificationV2/useCertificationRun'),
  useLatestCertificationRuns: jest.fn(),
  useStartCertificationRun: jest.fn(),
}));
jest.mock('../CertificationV2/CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: (p: {
    teamId: number;
    edfiTenantId?: number;
    odsId?: number;
    isDisabled?: boolean;
  }) => (
    <div
      data-testid="auth-form"
      data-team={p.teamId}
      data-tenant={p.edfiTenantId ?? ''}
      data-ods={p.odsId ?? ''}
      data-disabled={String(!!p.isDisabled)}
    />
  ),
}));

const urls = {
  oauth: 'https://localhost/multi/{tenantIdentifier}/oauth/token',
  dataManagementApi: 'https://localhost/multi/{tenantIdentifier}/data/v3/',
};
const env = (id: number, odsDsVersion = '5.2.0') => ({
  id,
  displayName: `Env ${id}`,
  version: 'v3',
  odsDsVersion,
  configPublic: { odsApiMeta: { urls } },
});
const tenant = (id: number) => ({ id, name: `tenant${id}`, displayName: `Tenant ${id}` });
const ods = (id: number) => ({ id, displayName: `Store ${id}` });
const byId = <T extends { id: number }>(...items: T[]) =>
  Object.fromEntries(items.map((item) => [item.id, item]));

type Lists = { envs: object; tenants: object; odss: object };
const single: Lists = { envs: byId(env(1)), tenants: byId(tenant(10)), odss: byId(ods(5)) };
const many: Lists = {
  envs: byId(env(1), env(2)),
  tenants: byId(tenant(10), tenant(11)),
  odss: byId(ods(5), ods(6)),
};

const validAuth = (edfiTenantId: number, odsId: number) => ({
  token: 't',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  oauthUrl: 'https://h/oauth/token',
  resourceBaseUrl: 'https://h/data/v3',
  edfiTenantId,
  odsId,
});

const mutate = jest.fn();
const onClose = jest.fn();

const setup = ({
  lists = single,
  auth = null as object | null,
  latestByModel = {},
  latestPending = false,
  start = {},
}: {
  lists?: Lists;
  auth?: object | null;
  latestByModel?: object;
  latestPending?: boolean;
  start?: object;
} = {}) => {
  (useQuery as jest.Mock).mockImplementation((options: { key: keyof Lists; enabled?: boolean }) =>
    options.enabled === false
      ? { data: undefined, isPending: true }
      : { data: lists[options.key], isPending: false },
  );
  (useCertificationAuth as jest.Mock).mockReturnValue({ auth });
  (useLatestCertificationRuns as jest.Mock).mockReturnValue({
    latestByModel,
    isPending: latestPending,
  });
  (useStartCertificationRun as jest.Mock).mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    reset: jest.fn(),
    ...start,
  });
  return render(<RequestCertificationModal teamId={2} isOpen onClose={onClose} />);
};

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const choose = (label: string, value: number | string) =>
  fireEvent.change(select(label), { target: { value: String(value) } });
const startButton = () => screen.getByRole('button', { name: 'Start Run' }) as HTMLButtonElement;
const lastQuery = (key: string) =>
  (useQuery as jest.Mock).mock.calls
    .map(([options]) => options)
    .filter((o) => o.key === key)
    .at(-1);
const authForm = () => screen.getByTestId('auth-form');

describe('RequestCertificationModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows where to certify, the credentials, the Certification Model and Start Run', () => {
    setup();

    expect(screen.getByText('Request New Certification')).toBeTruthy();
    expect(select('Environment')).toBeTruthy();
    expect(select('Tenant')).toBeTruthy();
    expect(select('Data Store')).toBeTruthy();
    expect(authForm()).toBeTruthy();
    expect(select('Certification Model')).toBeTruthy();
    expect(startButton()).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isPending: true });
    (useCertificationAuth as jest.Mock).mockReturnValue({ auth: null });
    (useLatestCertificationRuns as jest.Mock).mockReturnValue({ latestByModel: {} });
    (useStartCertificationRun as jest.Mock).mockReturnValue({ mutate, reset: jest.fn() });
    render(<RequestCertificationModal teamId={2} isOpen={false} onClose={onClose} />);

    expect(screen.queryByText('Request New Certification')).toBeNull();
  });

  describe('choosing where to certify', () => {
    it("asks for the team's environments, tenants and data stores", () => {
      setup();

      expect(lastQuery('envs')).toMatchObject({ teamId: 2 });
      expect(lastQuery('tenants')).toMatchObject({ teamId: 2, sbEnvironmentId: 1 });
      expect(lastQuery('odss')).toMatchObject({ teamId: 2, edfiTenant: { id: 10 } });
    });

    it('chooses for me when a list has only one option', () => {
      setup();

      expect(select('Environment').value).toBe('1');
      expect(select('Tenant').value).toBe('10');
      expect(select('Data Store').value).toBe('5');
      expect(select('Certification Model').value).toBe('SIS');
      expect(select('Environment').disabled).toBe(true);
      expect(authForm().dataset).toMatchObject({
        team: '2',
        tenant: '10',
        ods: '5',
        disabled: 'false',
      });
    });

    it('chooses nothing when there are several options, and each choice narrows the next list', () => {
      setup({ lists: many });

      expect(select('Environment').value).toBe('');
      expect(lastQuery('tenants').enabled).toBe(false);
      expect(select('Tenant').disabled).toBe(true);
      expect(authForm().dataset.disabled).toBe('true');

      choose('Environment', 2);
      expect(lastQuery('tenants')).toMatchObject({ sbEnvironmentId: 2, enabled: true });
      expect(lastQuery('odss').enabled).toBe(false);

      choose('Tenant', 11);
      expect(lastQuery('odss')).toMatchObject({ edfiTenant: { id: 11 }, enabled: true });

      choose('Data Store', 6);
      expect(authForm().dataset).toMatchObject({ tenant: '11', ods: '6', disabled: 'false' });
    });

    it('clears the lists below when a choice above changes', () => {
      setup({ lists: many });
      choose('Environment', 1);
      choose('Tenant', 10);
      choose('Data Store', 5);

      choose('Environment', 2);

      expect(select('Tenant').value).toBe('');
      expect(select('Data Store').value).toBe('');
      expect(authForm().dataset).toMatchObject({ tenant: '', ods: '' });
    });

    it("leaves out environments that can't be certified", () => {
      setup({ lists: { ...single, envs: byId(env(1), env(3, '4.0.0')) } });

      const options = Array.from(select('Environment').options).map((option) => option.text);
      expect(options).toEqual(['Select environment', 'Env 1']);
      expect(select('Environment').value).toBe('1');
    });

    it('says so when the team has no environment that can be certified', () => {
      setup({ lists: { ...single, envs: byId(env(3, '4.0.0')) } });

      expect(screen.getByText(/no environment that can be certified/)).toBeTruthy();
      expect(startButton().disabled).toBe(true);
    });

    it("warns about context-based routing, which certification doesn't support", () => {
      const contextEnv = {
        ...env(1),
        configPublic: {
          odsApiMeta: {
            urls: {
              oauth: 'https://localhost/{tenantIdentifier}/{schoolYearFromRoute}/oauth/token',
              dataManagementApi:
                'https://localhost/{tenantIdentifier}/{schoolYearFromRoute}/data/v3/',
            },
          },
        },
      };
      setup({ lists: { ...single, envs: byId(contextEnv) }, auth: validAuth(10, 5) });

      expect(screen.getByText(/context-based routing/)).toBeTruthy();
      expect(startButton().disabled).toBe(true);
    });
  });

  describe('credentials', () => {
    it('keeps Start Run disabled until the credentials are validated', () => {
      setup();

      expect(startButton().disabled).toBe(true);
    });

    it('enables Start Run once they are validated for the chosen data store', () => {
      setup({ auth: validAuth(10, 5) });

      expect(startButton().disabled).toBe(false);
    });

    it('disables Start Run again when the data store changes after validating', () => {
      setup({ lists: { ...single, odss: byId(ods(5), ods(6)) }, auth: validAuth(10, 5) });
      choose('Data Store', 5);
      expect(startButton().disabled).toBe(false);

      choose('Data Store', 6);

      expect(startButton().disabled).toBe(true);
    });

    it('does not accept credentials that have expired', () => {
      setup({
        auth: { ...validAuth(10, 5), expiresAt: new Date(Date.now() - 1000).toISOString() },
      });

      expect(startButton().disabled).toBe(true);
    });
  });

  describe('Certification Model', () => {
    const open = { SIS: { certificationModel: 'SIS', runId: 7, status: 'DRAFT', isOpen: true } };

    it('lists only SIS', () => {
      setup();

      expect(Array.from(select('Certification Model').options).map((o) => o.text)).toEqual([
        'Select Certification Model',
        'SIS',
      ]);
    });

    it("reads the chosen data store's runs", () => {
      setup();

      expect(useLatestCertificationRuns).toHaveBeenLastCalledWith({
        teamId: 2,
        edfiTenantId: 10,
        odsId: 5,
      });
    });

    it('disables a model whose run on the data store is open, and says why', () => {
      setup({ auth: validAuth(10, 5), latestByModel: open });

      const sis = select('Certification Model').options[1];
      expect(sis.disabled).toBe(true);
      expect(sis.text).toBe('SIS (a run is already open)');
      expect(select('Certification Model').value).toBe('');
      expect(screen.getByText('A SIS run is already open for this data store.')).toBeTruthy();
      expect(startButton().disabled).toBe(true);
    });

    it("keeps Start Run disabled until the data store's runs have loaded", () => {
      // Until then an open run is unknown, and the request would only come back as a 409.
      setup({ auth: validAuth(10, 5), latestPending: true });

      expect(startButton().disabled).toBe(true);
    });

    it.each(['REJECTED', 'APPROVED'])('frees the model once its run is %s', (status) => {
      setup({
        auth: validAuth(10, 5),
        latestByModel: { SIS: { certificationModel: 'SIS', runId: 7, status, isOpen: false } },
      });

      expect(select('Certification Model').options[1].disabled).toBe(false);
      expect(screen.queryByText(/already open/)).toBeNull();
      expect(startButton().disabled).toBe(false);
    });
  });

  describe('Start Run', () => {
    it('starts a run for the data store and model, then opens its Scenarios page', () => {
      mutate.mockImplementation((_variables, options) => options.onSuccess({ runId: 7 }));
      setup({ auth: validAuth(10, 5) });

      fireEvent.click(startButton());

      expect(mutate).toHaveBeenCalledWith(
        { teamId: 2, edfiTenantId: 10, body: { odsId: 5, certificationModel: 'SIS' } },
        expect.anything(),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/as/2/certification/runs/7');
    });

    it('shows why the run was refused and stays open', () => {
      setup({
        auth: validAuth(10, 5),
        start: { error: { message: 'A SIS run is already open for this data store.' } },
      });

      expect(screen.getByRole('alert').textContent).toContain(
        'A SIS run is already open for this data store.',
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows progress while the run is being created', () => {
      setup({ auth: validAuth(10, 5), start: { isPending: true } });

      expect(startButton().disabled).toBe(true);
    });
  });

  it('closes on Cancel', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
