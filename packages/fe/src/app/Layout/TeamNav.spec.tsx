import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { useMatches, useParams } from 'react-router';
import { TeamNav } from './TeamNav';
import { sbEnvironmentQueries, teamQueries } from '../api';
import { useGetManyIntegrationProviders } from '../api-v2';
import { useCanSeeCertification } from '../Pages/MyProducts/useCanSeeCertification';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({})),
}));

jest.mock('jotai', () => ({
  useAtom: jest.fn(() => [{}, jest.fn()]),
}));

jest.mock('jotai/utils', () => ({
  atomWithStorage: jest.fn(() => 'mock-nav-pin-atom'),
}));

jest.mock('react-router', () => ({
  useMatches: jest.fn(() => []),
  useParams: jest.fn(() => ({})),
  Link: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock('../api', () => ({
  sbEnvironmentQueries: { getAll: jest.fn(() => ({ queryKey: ['sb-environments-key'] })) },
  teamQueries: { navSearchList: jest.fn(() => ({ queryKey: ['nav-search-key'] })) },
}));

jest.mock('../api-v2', () => ({
  useGetManyIntegrationProviders: jest.fn(() => ({ data: [] })),
}));

jest.mock('../routes/paths', () => ({
  usePaths: jest.fn(() => ({
    integrationProvider: { index: () => '/integration-providers' },
    myProducts: { index: () => '/as/7/my-products' },
  })),
}));

jest.mock('../helpers', () => ({
  arrayElemIf: jest.requireActual('../helpers/arrayElemIf').arrayElemIf,
  getOdsTerminology: jest.requireActual('../helpers/useOdsTerminology').getOdsTerminology,
  authorize: jest.fn(() => true),
  useAuthorize: jest.fn(() => true),
  usePrivilegeCacheForConfig: jest.fn(),
}));

jest.mock('../Pages/MyProducts/useCanSeeCertification', () => ({
  useCanSeeCertification: jest.fn(() => ({ canSee: false, isLoading: false, error: null })),
}));

jest.mock('./EnvironmentsNav', () => ({
  EnvironmentsNav: () => null,
}));

jest.mock('./UniversalNavLinks', () => ({
  UniversalNavLinks: () => null,
}));

jest.mock('@edanalytics/common-ui', () => ({
  Icons: new Proxy(
    {},
    {
      get: () => () => null,
    }
  ),
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseAtom = useAtom as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseParams = useParams as jest.Mock;
const mockSbEnvironmentsGetAll = sbEnvironmentQueries.getAll as jest.Mock;
const mockNavSearchList = teamQueries.navSearchList as jest.Mock;
const mockUseGetManyIntegrationProviders = useGetManyIntegrationProviders as jest.Mock;
const mockUseCanSeeCertification = useCanSeeCertification as jest.Mock;

const renderTeamNavForTenant = (sbEnvironmentVersion: string) => {
  mockUseParams.mockReturnValue({ edfiTenantId: '100', sbEnvironmentId: '10' });
  mockUseQuery.mockImplementation((options: { queryKey?: string[] }) => {
    if (options.queryKey?.[0] === 'sb-environments-key') {
      return {
        data: {
          10: { id: 10, displayName: 'Env One', version: sbEnvironmentVersion },
        },
      };
    }
    if (options.queryKey?.[0] === 'nav-search-key') {
      return {
        data: {
          k1: { sbEnvironmentId: 10, edfiTenantId: 100, edfiTenantName: 'Tenant A' },
        },
      };
    }
    return { data: undefined };
  });

  render(<TeamNav teamId="1" />);
};

describe('TeamNav — ODS/Data Store sidebar label', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAtom.mockReturnValue([{}, jest.fn()]);
    mockUseMatches.mockReturnValue([]);
    mockUseQueryClient.mockReturnValue({});
    mockUseGetManyIntegrationProviders.mockReturnValue({ data: [] });
    mockSbEnvironmentsGetAll.mockReturnValue({ queryKey: ['sb-environments-key'] });
    mockNavSearchList.mockReturnValue({ queryKey: ['nav-search-key'] });
  });

  it('shows "Data Stores" for a v3 tenant', () => {
    renderTeamNavForTenant('v3');

    expect(screen.getByText('Data Stores')).toBeInTheDocument();
    expect(screen.queryByText('ODSs')).not.toBeInTheDocument();
  });

  it('shows "ODSs" for a v2 tenant', () => {
    renderTeamNavForTenant('v2');

    expect(screen.getByText('ODSs')).toBeInTheDocument();
    expect(screen.queryByText('Data Stores')).not.toBeInTheDocument();
  });

  it('shows "ODSs" for a v1 tenant', () => {
    renderTeamNavForTenant('v1');

    expect(screen.getByText('ODSs')).toBeInTheDocument();
  });
});

describe('TeamNav - Certification menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAtom.mockReturnValue([{}, jest.fn()]);
    mockUseMatches.mockReturnValue([]);
    mockUseParams.mockReturnValue({});
    mockUseQueryClient.mockReturnValue({});
    mockUseQuery.mockReturnValue({ data: undefined });
    mockUseGetManyIntegrationProviders.mockReturnValue({ data: [] });
    mockUseCanSeeCertification.mockReturnValue({ canSee: false, isLoading: false });
  });

  it('shows the Certification heading with My products when the hook allows it', () => {
    mockUseCanSeeCertification.mockReturnValue({ canSee: true, isLoading: false });

    render(<TeamNav teamId="7" />);

    expect(mockUseCanSeeCertification).toHaveBeenCalledWith(7);
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByTitle('My products')).toHaveAttribute('to', '/as/7/my-products');
  });

  it('hides the Certification heading when the hook denies it', () => {
    render(<TeamNav teamId="7" />);

    expect(screen.queryByText('Certification')).not.toBeInTheDocument();
    expect(screen.queryByText('My products')).not.toBeInTheDocument();
  });

  it('marks My products active on /as/:asId/my-products', () => {
    mockUseCanSeeCertification.mockReturnValue({ canSee: true, isLoading: false });
    mockUseMatches.mockReturnValue([{ pathname: '/as/7/my-products' }]);

    render(<TeamNav teamId="7" />);

    expect(screen.getByTitle('My products')).toHaveAttribute('aria-current', 'page');
  });
});
