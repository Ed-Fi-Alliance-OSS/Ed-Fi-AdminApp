import 'reflect-metadata';
import { render, screen } from '@testing-library/react';
import { DataStoreCard } from './DataStoreCard';

// The real react-router is ESM-only and can't be loaded by this Jest setup.
jest.mock('react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../../routes/paths', () => ({
  certificationRunPath: (asId: number, runId: number) => `/as/${asId}/certification/runs/${runId}`,
}));

const dataStore = {
  edfiTenantId: 1,
  odsId: 2,
  environmentName: 'Env 1',
  tenantName: 'tenant1',
  dataStoreName: 'EdFi_Ods_1',
  runs: [
    { runId: 55, certificationModel: 'SIS', status: 'DRAFT' },
    { runId: 56, certificationModel: 'MTSS', status: 'APPROVED' },
  ],
} as never;

describe('DataStoreCard', () => {
  it('shows environment, tenant and data store names', () => {
    render(<DataStoreCard teamId={7} dataStore={dataStore} />);
    expect(screen.getByText(/Env 1/)).toBeTruthy();
    expect(screen.getByText(/tenant1/)).toBeTruthy();
    expect(screen.getByText(/EdFi_Ods_1/)).toBeTruthy();
  });

  it('lists each run with model, status label and an Open link to the run', () => {
    render(<DataStoreCard teamId={7} dataStore={dataStore} />);
    expect(screen.getByText('SIS')).toBeTruthy();
    expect(screen.getByText('MTSS')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: /^Open / });
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Open SIS run on EdFi_Ods_1',
      'Open MTSS run on EdFi_Ods_1',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/as/7/certification/runs/55',
      '/as/7/certification/runs/56',
    ]);
  });
});
