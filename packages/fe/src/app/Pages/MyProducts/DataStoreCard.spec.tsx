import 'reflect-metadata';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DataStoreCard } from './DataStoreCard';

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
    render(
      <MemoryRouter>
        <DataStoreCard teamId={7} dataStore={dataStore} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Env 1/)).toBeTruthy();
    expect(screen.getByText(/tenant1/)).toBeTruthy();
    expect(screen.getByText(/EdFi_Ods_1/)).toBeTruthy();
  });

  it('lists each run with model, status label and an Open link to the run', () => {
    render(
      <MemoryRouter>
        <DataStoreCard teamId={7} dataStore={dataStore} />
      </MemoryRouter>
    );
    expect(screen.getByText('SIS')).toBeTruthy();
    expect(screen.getByText('MTSS')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Open' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/as/7/certification/runs/55',
      '/as/7/certification/runs/56',
    ]);
  });
});
