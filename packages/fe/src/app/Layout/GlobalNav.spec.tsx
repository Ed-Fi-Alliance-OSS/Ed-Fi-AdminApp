import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { config } from '../../config/config';
import { authorize, useAuthorize } from '../helpers';
import { GlobalNav } from './GlobalNav';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: undefined })),
  useQueryClient: jest.fn(() => ({})),
}));

jest.mock('react-router', () => ({
  useMatches: jest.fn(() => []),
  Link: ({ children, ...props }: { children?: React.ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock('../api', () => ({
  sbEnvironmentQueries: { getAll: jest.fn(() => ({ queryKey: ['sb-environments-key'] })) },
}));

jest.mock('../../config/config', () => ({ config: { showRequestCertification: true } }));

jest.mock('../routes/paths', () => ({
  usePaths: jest.fn(() => ({
    integrationProvider: { index: () => '/integration-providers' },
    certificationDashboard: { index: () => '/certification/dashboard' },
  })),
}));

jest.mock('../helpers', () => ({
  arrayElemIf: jest.requireActual('../helpers/arrayElemIf').arrayElemIf,
  authorize: jest.fn(),
  useAuthorize: jest.fn(() => false),
  usePrivilegeCacheForConfig: jest.fn(),
}));

jest.mock('./NavButton', () => ({
  NavButton: ({ text, route }: { text: string; route: string }) => <a href={route}>{text}</a>,
}));

jest.mock('./UniversalNavLinks', () => ({ UniversalNavLinks: () => null }));

jest.mock('@edanalytics/common-ui', () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

const mockAuthorize = authorize as jest.Mock;

/** Grants every privilege except the ones named in `denied`. */
const grantAllExcept = (...denied: string[]) =>
  mockAuthorize.mockImplementation(
    ({ config: { privilege } }: { config: { privilege: string } }) => !denied.includes(privilege),
  );

describe('GlobalNav — Certification menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({});
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });
    (useAuthorize as jest.Mock).mockReturnValue(false);
    jest.replaceProperty(config, 'showRequestCertification', true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows Certification heading and Dashboard when privileged and flag on', () => {
    grantAllExcept();
    render(<GlobalNav />);
    expect(screen.getByText('Certification')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('hides it without certification:read', () => {
    grantAllExcept('certification:read');
    render(<GlobalNav />);
    expect(screen.queryByText('Certification')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('hides it when the flag is off', () => {
    jest.replaceProperty(config, 'showRequestCertification', false);
    grantAllExcept();
    render(<GlobalNav />);
    expect(screen.queryByText('Certification')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('Dashboard links to /certification/dashboard', () => {
    grantAllExcept();
    render(<GlobalNav />);
    expect(screen.getByText('Dashboard')).toHaveAttribute('href', '/certification/dashboard');
  });

  it('keeps the other global items unchanged', () => {
    grantAllExcept();
    render(<GlobalNav />);
    for (const text of ['Environments', 'Teams', 'Users', 'Roles', 'Ownerships', 'Sync queue']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});
