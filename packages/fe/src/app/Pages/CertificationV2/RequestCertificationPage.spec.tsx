import 'reflect-metadata';
import { fireEvent, render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { RequestCertificationPage } from './RequestCertificationPage';
import { useCertificationSelection } from './useCertificationSelection';
import { useCertificationAuth } from './CertificationAuthContext';

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sbEnvironmentId: '1' }),
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Icons: { InfoCircle: () => null },
}));
jest.mock('../../api', () => ({
  sbEnvironmentQueriesGlobal: { getOne: (a: object) => ({ key: 'env', ...a }) },
  edfiTenantQueriesGlobal: { getAll: (a: object) => ({ key: 'tenants', ...a }) },
  odsQueries: { getAll: (a: object) => ({ key: 'odss', ...a }) },
}));
jest.mock('../../helpers', () => ({
  getOdsTerminology: (version: string | undefined) => ({
    singular: version === 'v3' ? 'Data Store' : 'ODS',
  }),
  useNavToParent: () => '..',
}));
jest.mock('../../../config/config', () => ({ config: { showRequestCertification: true } }));
jest.mock('./useCertificationSelection', () => ({ useCertificationSelection: jest.fn() }));
jest.mock('./CertificationAuthContext', () => ({
  ...jest.requireActual('./CertificationAuthContext'),
  useCertificationAuth: jest.fn(),
}));
jest.mock('./CertificationAuthenticateForm', () => ({
  CertificationAuthenticateForm: (p: { isDisabled?: boolean }) => (
    <div data-testid="auth-form" data-disabled={String(!!p.isDisabled)} />
  ),
}));

const setSelection = jest.fn();
const multiTenantEnv = {
  id: 1,
  version: 'v3',
  configPublic: {
    odsApiMeta: {
      urls: {
        oauth: 'https://localhost/multi/{tenantIdentifier}/oauth/token',
        dataManagementApi: 'https://localhost/multi/{tenantIdentifier}/data/v3/',
      },
    },
  },
};
const tenants = {
  10: { id: 10, name: 'tenant1', displayName: 'Tenant One' },
  11: { id: 11, name: 'tenant2', displayName: 'Tenant Two' },
};
const odss = { 5: { id: 5, displayName: 'EdFi_Ods_255901' } };
const twoOdss = { ...odss, 6: { id: 6, displayName: 'EdFi_Ods_255902' } };

type QueryState = { isPending?: boolean };

const mockQueries = (
  env: object,
  tenantRecord: object,
  odsRecord: object,
  odsState: QueryState = {},
) =>
  (useQuery as jest.Mock).mockImplementation(({ key }: { key: string }) => ({
    data: key === 'env' ? env : key === 'tenants' ? tenantRecord : odsRecord,
    isPending: key === 'odss' ? !!odsState.isPending : false,
  }));

describe('RequestCertificationPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: null,
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: undefined,
      scenarioId: undefined,
      setSelection,
      toSearch: (e: { scenarioId?: number } = {}) => `?edfiTenantId=10&scenarioId=${e.scenarioId}`,
    });
  });

  it('labels the ODS field "Data Store" on v3 and no longer shows an API address', () => {
    mockQueries(multiTenantEnv, tenants, odss);
    render(<RequestCertificationPage />);
    expect(screen.getByText('Tenant')).toBeTruthy();
    expect(screen.getByText('Data Store')).toBeTruthy();
    expect(screen.queryByText(/API address/)).toBeNull();
  });

  it('picks the only tenant automatically and shows it disabled', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: undefined,
      odsId: undefined,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    mockQueries(multiTenantEnv, { 10: tenants[10] }, {});
    render(<RequestCertificationPage />);
    expect(setSelection).toHaveBeenCalledWith({ edfiTenantId: 10, odsId: undefined });
    expect(screen.getByText('Tenant')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: /Tenant/ }) as HTMLSelectElement).disabled).toBe(
      true,
    );
  });

  it('shows the only tenant by name in a disabled select', () => {
    mockQueries(multiTenantEnv, { 10: tenants[10] }, {});
    render(<RequestCertificationPage />);
    expect((screen.getByDisplayValue('Tenant One') as HTMLSelectElement).disabled).toBe(true);
  });

  it('enables the tenant select when there are several tenants', () => {
    mockQueries(multiTenantEnv, tenants, {});
    render(<RequestCertificationPage />);
    expect((screen.getByDisplayValue('Tenant One') as HTMLSelectElement).disabled).toBe(false);
  });

  it('auto-selects the only ODS and shows it disabled', () => {
    mockQueries(multiTenantEnv, tenants, odss);
    const { rerender } = render(<RequestCertificationPage />);
    expect(setSelection).toHaveBeenCalledWith({ odsId: 5 });
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: 5,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    rerender(<RequestCertificationPage />);
    expect((screen.getByDisplayValue('EdFi_Ods_255901') as HTMLSelectElement).disabled).toBe(true);
  });

  it('keeps the ODS select enabled and does not auto-select with several ODSs', () => {
    mockQueries(multiTenantEnv, tenants, twoOdss);
    render(<RequestCertificationPage />);
    expect(setSelection).not.toHaveBeenCalled();
    const select = screen.getByRole('combobox', { name: /Data Store/ }) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  it('does not auto-select the only ODS on a context-routing environment', () => {
    mockQueries(
      {
        ...multiTenantEnv,
        configPublic: {
          odsApiMeta: {
            urls: {
              oauth: 'https://h/oauth/token',
              dataManagementApi: 'https://h/{instanceId}/data/v3/',
            },
          },
        },
      },
      tenants,
      odss,
    );
    render(<RequestCertificationPage />);
    expect(setSelection).not.toHaveBeenCalledWith({ odsId: 5 });
  });

  it('does not auto-select an ODS on v1', () => {
    mockQueries({ ...multiTenantEnv, version: 'v1' }, tenants, odss);
    render(<RequestCertificationPage />);
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('treats a stale tenant ID as unset and picks the only real tenant', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 99,
      odsId: undefined,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    mockQueries(multiTenantEnv, { 10: tenants[10] }, {});
    render(<RequestCertificationPage />);
    expect(setSelection).toHaveBeenCalledWith({ edfiTenantId: 10, odsId: undefined });
  });

  it('clears a stale tenant ID when there are several tenants', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 99,
      odsId: undefined,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    mockQueries(multiTenantEnv, tenants, {});
    render(<RequestCertificationPage />);
    expect(setSelection).toHaveBeenCalledWith({ edfiTenantId: undefined, odsId: undefined });
  });

  it('clears an ODS ID that is not in the list for the tenant', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: 77,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    mockQueries(multiTenantEnv, tenants, odss);
    render(<RequestCertificationPage />);
    expect(setSelection).toHaveBeenCalledWith({ odsId: undefined });
  });

  it('makes the tooltip triggers focusable and labelled', () => {
    mockQueries(multiTenantEnv, tenants, odss);
    render(<RequestCertificationPage />);
    expect(screen.getByLabelText('About Tenant').getAttribute('tabindex')).toBe('0');
    expect(screen.getByLabelText('About Data Store')).toBeTruthy();
  });

  it('hides the ODS field on v1', () => {
    mockQueries({ ...multiTenantEnv, version: 'v1' }, tenants, odss);
    render(<RequestCertificationPage />);
    expect(screen.queryByText('ODS')).toBeNull();
    expect(screen.queryByText('Data Store')).toBeNull();
  });

  it('for context routing, shows the warning first and only a Cancel button', () => {
    mockQueries(
      {
        ...multiTenantEnv,
        configPublic: {
          odsApiMeta: {
            urls: {
              oauth: 'https://h/oauth/token',
              dataManagementApi: 'https://h/{instanceId}/data/v3/',
            },
          },
        },
      },
      tenants,
      {},
    );
    const { container } = render(<RequestCertificationPage />);
    const alert = screen.getByText(
      /context-based routing, which certification doesn't support yet/,
    );
    expect(container.firstElementChild?.firstElementChild).toBe(alert.closest('[role="alert"]'));
    expect(screen.queryByText('Tenant')).toBeNull();
    expect(screen.queryByTestId('auth-form')).toBeNull();
    expect(screen.queryByText('Scenarios Version')).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Validate Scenario' })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('keeps the form disabled while the ODS list is loading', () => {
    mockQueries(multiTenantEnv, tenants, {}, { isPending: true });
    render(<RequestCertificationPage />);
    expect(screen.getByTestId('auth-form').getAttribute('data-disabled')).toBe('true');
  });

  it('enables the form once the ODS list has loaded and an ODS is chosen', () => {
    (useCertificationSelection as jest.Mock).mockReturnValue({
      edfiTenantId: 10,
      odsId: 5,
      scenarioId: undefined,
      setSelection,
      toSearch: () => '?',
    });
    mockQueries(multiTenantEnv, tenants, odss);
    render(<RequestCertificationPage />);
    expect(screen.getByTestId('auth-form').getAttribute('data-disabled')).toBe('false');
  });

  it('keeps Validate Scenario disabled until authenticated, then navigates with the query string', () => {
    mockQueries(multiTenantEnv, tenants, {});
    const { rerender } = render(<RequestCertificationPage />);
    const firstButton = () =>
      screen.getAllByRole('button', { name: 'Validate Scenario' })[0] as HTMLButtonElement;
    expect(firstButton().disabled).toBe(true);

    (useCertificationAuth as jest.Mock).mockReturnValue({
      auth: {
        token: 't',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        oauthUrl: 'o',
        resourceBaseUrl: 'r',
        edfiTenantId: 10,
        odsId: undefined,
      },
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
    });
    rerender(<RequestCertificationPage />);
    fireEvent.click(firstButton());
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: 'execution',
      search: expect.stringMatching(/^\?edfiTenantId=10&scenarioId=\d+$/),
    });
  });
});
