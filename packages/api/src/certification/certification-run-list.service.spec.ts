import 'reflect-metadata';
import { CertificationRunListService } from './certification-run-list.service';

const run = (id: number, overrides: Record<string, unknown> = {}) => ({
  certificationRunId: id,
  certificationModel: 'SIS',
  status: 'READY_FOR_REVIEW',
  statusChangedAt: new Date('2026-11-10T10:00:00.000Z'),
  submittedAt: new Date('2026-11-09T09:00:00.000Z'),
  updatedAt: new Date('2026-11-11T11:00:00.000Z'),
  team: { name: 'Team A' },
  edfiTenant: { name: 'tenant1', sbEnvironment: { displayName: 'Env 1' } },
  ods: { odsInstanceName: 'Ods One', dbName: 'EdFi_Ods_1' },
  ...overrides,
});

const setup = (runs: unknown[]) => {
  const builder: Record<string, jest.Mock> = {};
  builder.leftJoinAndSelect = jest.fn().mockReturnValue(builder);
  builder.getMany = jest.fn().mockResolvedValue(runs);
  const createQueryBuilder = jest.fn().mockReturnValue(builder);
  const service = new CertificationRunListService({ createQueryBuilder } as never);
  return { service, builder };
};

const idsOf = (list: { rows: { runId: number }[] }) => list.rows.map((row) => row.runId);

describe('CertificationRunListService.getRuns', () => {
  it('returns every run mapped to the dashboard row shape', async () => {
    const { service } = setup([run(7)]);
    await expect(service.getRuns()).resolves.toEqual({
      rows: [
        {
          runId: 7,
          teamName: 'Team A',
          sbEnvironmentName: 'Env 1',
          edfiTenantName: 'tenant1',
          dataStore: 'Ods One',
          certificationModel: 'SIS',
          status: 'READY_FOR_REVIEW',
          statusChangedAt: '2026-11-10T10:00:00.000Z',
          submittedAt: '2026-11-09T09:00:00.000Z',
          updatedAt: '2026-11-11T11:00:00.000Z',
        },
      ],
      total: 1,
    });
  });

  it('joins team, tenant, environment and ODS and applies no filter or cap', async () => {
    const { service, builder } = setup([]);
    await service.getRuns();
    expect(builder.leftJoinAndSelect.mock.calls.map(([path]) => path)).toEqual([
      'run.team',
      'run.edfiTenant',
      'edfiTenant.sbEnvironment',
      'run.ods',
    ]);
  });

  it('orders waiting runs first by submittedAt ascending, then IN_REVIEW, then the rest by updatedAt descending', async () => {
    const { service } = setup([
      run(1, { status: 'APPROVED', updatedAt: new Date('2026-11-01T00:00:00.000Z') }),
      run(2, { status: 'REJECTED', updatedAt: new Date('2026-11-05T00:00:00.000Z') }),
      run(3, { status: 'IN_REVIEW', submittedAt: new Date('2026-11-02T00:00:00.000Z') }),
      run(4, { status: 'READY_FOR_REVIEW', submittedAt: new Date('2026-11-08T00:00:00.000Z') }),
      run(5, {
        status: 'READY_FOR_REVIEW_WITH_CHANGES',
        submittedAt: new Date('2026-11-03T00:00:00.000Z'),
      }),
      run(6, { status: 'DRAFT', updatedAt: new Date('2026-11-07T00:00:00.000Z') }),
    ]);
    expect(idsOf(await service.getRuns())).toEqual([5, 4, 3, 6, 2, 1]);
  });

  it('sorts a waiting run with null submittedAt by statusChangedAt', async () => {
    const { service } = setup([
      run(1, { submittedAt: new Date('2026-11-09T00:00:00.000Z') }),
      run(2, {
        submittedAt: null,
        statusChangedAt: new Date('2026-11-05T00:00:00.000Z'),
      }),
      run(3, { submittedAt: new Date('2026-11-01T00:00:00.000Z') }),
    ]);
    expect(idsOf(await service.getRuns())).toEqual([3, 2, 1]);
  });

  it('breaks ties by run id ascending', async () => {
    const sameTime = new Date('2026-11-09T00:00:00.000Z');
    const { service } = setup([
      run(9, { submittedAt: sameTime }),
      run(4, { submittedAt: sameTime }),
      run(6, { status: 'APPROVED', updatedAt: sameTime }),
      run(5, { status: 'APPROVED', updatedAt: sameTime }),
    ]);
    expect(idsOf(await service.getRuns())).toEqual([4, 9, 5, 6]);
  });

  it('maps a run with no team and no ODS', async () => {
    const { service } = setup([run(7, { team: null, ods: null, submittedAt: null })]);
    const { rows } = await service.getRuns();
    expect(rows[0]).toMatchObject({
      teamName: null,
      dataStore: null,
      sbEnvironmentName: 'Env 1',
      edfiTenantName: 'tenant1',
      submittedAt: null,
    });
  });

  it('returns total equal to the number of rows with no cap', async () => {
    const many = Array.from({ length: 150 }, (_, i) => run(i + 1));
    const { service } = setup(many);
    const list = await service.getRuns();
    expect(list.rows).toHaveLength(150);
    expect(list.total).toBe(150);
  });
});
