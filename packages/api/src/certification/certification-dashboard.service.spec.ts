import 'reflect-metadata';
import { CertificationDashboardService } from './certification-dashboard.service';

type Builder = Record<string, jest.Mock>;

const makeBuilder = (terminal: 'getRawMany' | 'getManyAndCount', result: unknown): Builder => {
  const builder: Builder = {};
  for (const method of [
    'select',
    'addSelect',
    'groupBy',
    'leftJoinAndSelect',
    'where',
    'orderBy',
    'addOrderBy',
    'take',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder[terminal] = jest.fn().mockResolvedValue(result);
  return builder;
};

const isoRun = (overrides: Record<string, unknown> = {}) => ({
  certificationRunId: 7,
  certificationModel: 'SIS',
  status: 'READY_FOR_REVIEW',
  statusChangedAt: new Date('2026-11-10T10:00:00.000Z'),
  updatedAt: new Date('2026-11-11T11:00:00.000Z'),
  team: { name: 'Team A' },
  edfiTenant: { name: 'tenant1', sbEnvironment: { displayName: 'Env 1' } },
  ods: { odsInstanceName: 'Ods One', dbName: 'EdFi_Ods_1' },
  ...overrides,
});

const setup = ({
  raw = [] as { status: string; count: string | number }[],
  waiting = [[], 0] as [unknown[], number],
  others = [[], 0] as [unknown[], number],
} = {}) => {
  const counts = makeBuilder('getRawMany', raw);
  const waitingBuilder = makeBuilder('getManyAndCount', waiting);
  const othersBuilder = makeBuilder('getManyAndCount', others);
  const createQueryBuilder = jest
    .fn()
    .mockReturnValueOnce(counts)
    .mockReturnValueOnce(waitingBuilder)
    .mockReturnValueOnce(othersBuilder);
  const service = new CertificationDashboardService({ createQueryBuilder } as never);
  return { service, counts, waitingBuilder, othersBuilder };
};

describe('CertificationDashboardService.getDashboard', () => {
  it('counts each card from its own status', async () => {
    const { service } = setup({
      raw: [
        { status: 'READY_FOR_REVIEW', count: '2' },
        { status: 'READY_FOR_REVIEW_WITH_CHANGES', count: '1' },
        { status: 'IN_REVIEW', count: 3 },
        { status: 'DRAFT', count: '4' },
        { status: 'CHANGES_REQUESTED', count: '9' },
      ],
    });
    const { counts } = await service.getDashboard();
    expect(counts).toEqual({
      newlyReadyForReview: 2,
      readyWithNewChanges: 1,
      pickedUp: 3,
      runsInFlight: 4,
    });
    for (const value of Object.values(counts)) expect(typeof value).toBe('number');
  });

  it('returns zero counts and empty lists when there are no runs', async () => {
    const { service } = setup();
    await expect(service.getDashboard()).resolves.toEqual({
      counts: { newlyReadyForReview: 0, readyWithNewChanges: 0, pickedUp: 0, runsInFlight: 0 },
      waiting: { rows: [], total: 0 },
      others: { rows: [], total: 0 },
    });
  });

  it('waiting query filters to the two review statuses and orders by statusChangedAt ASC then certificationRunId ASC, with no row limit', async () => {
    const { service, waitingBuilder } = setup();
    await service.getDashboard();
    expect(waitingBuilder.where).toHaveBeenCalledWith('run.status IN (:...statuses)', {
      statuses: ['READY_FOR_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES'],
    });
    expect(waitingBuilder.orderBy).toHaveBeenCalledWith('run.statusChangedAt', 'ASC');
    expect(waitingBuilder.addOrderBy).toHaveBeenCalledWith('run.certificationRunId', 'ASC');
    expect(waitingBuilder.take).not.toHaveBeenCalled();
  });

  it('others query filters to DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, REJECTED, orders by updatedAt DESC then certificationRunId DESC and takes 100', async () => {
    const { service, othersBuilder } = setup();
    await service.getDashboard();
    expect(othersBuilder.where).toHaveBeenCalledWith('run.status IN (:...statuses)', {
      statuses: ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
    });
    expect(othersBuilder.orderBy).toHaveBeenCalledWith('run.updatedAt', 'DESC');
    expect(othersBuilder.addOrderBy).toHaveBeenCalledWith('run.certificationRunId', 'DESC');
    expect(othersBuilder.take).toHaveBeenCalledWith(100);
  });

  it('total is the real count even when rows are capped', async () => {
    const { service } = setup({ others: [[isoRun()], 250] });
    const { others } = await service.getDashboard();
    expect(others.rows).toHaveLength(1);
    expect(others.total).toBe(250);
  });

  it('maps a run to the row DTO', async () => {
    const { service } = setup({ waiting: [[isoRun()], 1] });
    const { waiting } = await service.getDashboard();
    expect(waiting.rows[0]).toEqual({
      runId: 7,
      teamName: 'Team A',
      sbEnvironmentName: 'Env 1',
      edfiTenantName: 'tenant1',
      dataStore: 'Ods One',
      certificationModel: 'SIS',
      status: 'READY_FOR_REVIEW',
      statusChangedAt: '2026-11-10T10:00:00.000Z',
      updatedAt: '2026-11-11T11:00:00.000Z',
    });
  });

  it('falls back to the database name when the ODS has no instance name', async () => {
    const { service } = setup({
      waiting: [[isoRun({ ods: { odsInstanceName: null, dbName: 'EdFi_Ods_1' } })], 1],
    });
    const { waiting } = await service.getDashboard();
    expect(waiting.rows[0].dataStore).toBe('EdFi_Ods_1');
  });

  it('maps null team and null ods to null labels', async () => {
    const { service } = setup({ waiting: [[isoRun({ team: null, ods: null })], 1] });
    const { waiting } = await service.getDashboard();
    expect(waiting.rows[0].teamName).toBeNull();
    expect(waiting.rows[0].dataStore).toBeNull();
  });
});
