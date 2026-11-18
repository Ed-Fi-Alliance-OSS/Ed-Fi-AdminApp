import 'reflect-metadata';
import { render, screen, within } from '@testing-library/react';
import { CertificationRunsCard } from './CertificationRunsCard';

jest.mock('@edanalytics/common-ui', () => ({
  PageContentCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ContentSection: ({
    heading,
    children,
  }: {
    heading?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      {heading ? <h2>{heading}</h2> : null}
      {children}
    </section>
  ),
}));

const run = (overrides: Record<string, unknown> = {}) =>
  ({
    runId: 1,
    teamName: 'Team A',
    sbEnvironmentName: 'Env 1',
    edfiTenantName: 'tenant1',
    dataStore: 'Ods One',
    certificationModel: 'SIS',
    status: 'READY_FOR_REVIEW',
    statusChangedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: '2026-11-12T10:00:00.000Z',
    ...overrides,
  }) as never;

const list = (rows: unknown[], total = rows.length) => ({ rows, total }) as never;

describe('CertificationRunsCard', () => {
  it('renders the title and the Waiting column headers', () => {
    render(
      <CertificationRunsCard
        title="Waiting for review"
        list={list([run()])}
        timeColumn="Waiting"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Waiting for review' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Waiting for review' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(['Team', 'Data store', 'Certification Model', 'Status', 'Waiting']);
  });

  it('renders the Last updated column header', () => {
    render(
      <CertificationRunsCard
        title="Runs in flight or rejected"
        list={list([run({ status: 'IN_REVIEW' })])}
        timeColumn="Last updated"
      />,
    );

    const table = screen.getByRole('table', { name: 'Runs in flight or rejected' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      'Team',
      'Data store',
      'Certification Model',
      'Status',
      'Last updated',
    ]);
    expect(within(table).getByText('In review')).toBeTruthy();
  });

  it('renders rows in the order given, with status labels and elapsed time', () => {
    render(
      <CertificationRunsCard
        title="Waiting for review"
        list={list([
          run({ runId: 1, teamName: 'First Team' }),
          run({ runId: 2, teamName: 'Second Team' }),
          run({ runId: 3, teamName: 'Third Team', status: 'READY_FOR_REVIEW_WITH_CHANGES' }),
        ])}
        timeColumn="Waiting"
      />,
    );

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('First Team');
    expect(rows[0].textContent).toContain('3h 0m');
    expect(rows[1].textContent).toContain('Second Team');
    expect(rows[2].textContent).toContain('Ready for review with new changes');
  });

  it('shows a dash when there is no team', () => {
    render(
      <CertificationRunsCard
        title="Waiting for review"
        list={list([run({ teamName: null })])}
        timeColumn="Waiting"
      />,
    );
    expect(within(screen.getByRole('table')).getAllByText('—')).toHaveLength(1);
  });

  it('falls back to environment / tenant when the run has no data store', () => {
    render(
      <CertificationRunsCard
        title="Waiting for review"
        list={list([run({ dataStore: null })])}
        timeColumn="Waiting"
      />,
    );
    expect(screen.getByText('Env 1 / tenant1')).toBeTruthy();
  });

  it('shows the empty message and no table when total is 0', () => {
    render(
      <CertificationRunsCard
        title="Waiting for review"
        list={list([])}
        timeColumn="Waiting"
        emptyMessage="Nothing is waiting for review"
      />,
    );
    expect(screen.getByText('Nothing is waiting for review')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows nothing extra when empty and no empty message is given', () => {
    render(<CertificationRunsCard title="Others" list={list([])} timeColumn="Last updated" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('shows "Showing N of M" when total exceeds the rows listed', () => {
    const rows = Array.from({ length: 100 }, (_, i) => run({ runId: i + 1, status: 'DRAFT' }));
    render(
      <CertificationRunsCard title="Others" list={list(rows, 250)} timeColumn="Last updated" />,
    );
    expect(screen.getByText('Showing 100 of 250')).toBeTruthy();
  });

  it('does not show the "Showing" note when every run is listed', () => {
    render(
      <CertificationRunsCard
        title="Others"
        list={list([run({ status: 'DRAFT' })])}
        timeColumn="Last updated"
      />,
    );
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});
