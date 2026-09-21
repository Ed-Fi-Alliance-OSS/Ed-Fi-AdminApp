import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ViewEdfiTenant } from './ViewEdfiTenant';
import { useTeamSbEnvironmentNavContext } from '../../helpers';
import { GetEdfiTenantDto } from '@edanalytics/models';

jest.mock('@edanalytics/common-ui', () => ({
  Attribute: ({ label, value }: { label: string; value: string }) => (
    <div>
      {label}: {value}
    </div>
  ),
  AttributeContainer: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div>{label}</div>
      {children}
    </div>
  ),
  AttributesGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContentSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-router', () => ({
  Link: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock('../../routes', () => ({
  SbEnvironmentLink: () => null,
}));

jest.mock('../../api/queries/builder', () => ({
  queryFromEntity: jest.fn(() => ({ data: undefined })),
}));

// getOdsTerminology is pulled in via requireActual below; its home module
// (useOdsTerminology.ts) statically imports navContext.tsx, which in turn
// imports '../api' (real api/index.ts drags in config.ts, which is ESM-only
// and breaks under CJS jest transform) — stub it out since nothing in this
// spec exercises those queries.
jest.mock('../../api', () => ({
  edfiTenantQueries: {},
  sbEnvironmentQueries: {},
}));

jest.mock('../../helpers', () => ({
  ...jest.requireActual('../../helpers/useOdsTerminology'),
  AuthorizeComponent: ({ children }: { children: React.ReactNode }) => children,
  useTeamSbEnvironmentNavContext: jest.fn(),
}));

const mockUseTeamSbEnvironmentNavContext = useTeamSbEnvironmentNavContext as jest.Mock;

const edfiTenant = Object.assign(new GetEdfiTenantDto(), {
  id: 1,
  name: 'Tenant A',
  sbEnvironmentId: 10,
});

describe('ViewEdfiTenant — Resources ODS/Data Store link', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows "Data Stores" for a v3 environment', () => {
    mockUseTeamSbEnvironmentNavContext.mockReturnValue({
      teamId: 1,
      sbEnvironmentId: 10,
      sbEnvironment: { id: 10, version: 'v3' },
    });

    render(<ViewEdfiTenant edfiTenant={edfiTenant} />);

    expect(screen.getByText(/Data Stores/)).toBeInTheDocument();
    expect(screen.queryByText(/ODS's/)).not.toBeInTheDocument();
  });

  it('shows "ODS\'s" for a v2 environment', () => {
    mockUseTeamSbEnvironmentNavContext.mockReturnValue({
      teamId: 1,
      sbEnvironmentId: 10,
      sbEnvironment: { id: 10, version: 'v2' },
    });

    render(<ViewEdfiTenant edfiTenant={edfiTenant} />);

    expect(screen.getByText(/ODS's/)).toBeInTheDocument();
    expect(screen.queryByText(/Data Stores/)).not.toBeInTheDocument();
  });
});
