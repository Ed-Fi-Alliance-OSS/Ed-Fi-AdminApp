import 'reflect-metadata';
import { In } from 'typeorm';
import { CertificationTeamDashboardService } from './certification-team-dashboard.service';

type GroupRow = {
  edfiTenantId: number;
  odsId: number;
  certificationModel: string;
  maxId: string | number;
};

const run = (
  id: number,
  model: string,
  status: string,
  tenantId: number,
  odsId: number,
  names: { env?: string; tenant?: string; ods?: string } = {}
) => ({
  certificationRunId: id,
  certificationModel: model,
  status,
  edfiTenantId: tenantId,
  odsId,
  edfiTenant: {
    displayName: names.tenant ?? `tenant${tenantId}`,
    sbEnvironment: { displayName: names.env ?? 'env1' },
  },
  ods: { displayName: names.ods ?? `ods${odsId}` },
});

const setup = (grouped: GroupRow[], runs: ReturnType<typeof run>[]) => {
  const builder: Record<string, jest.Mock> = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue(grouped);
  const find = jest.fn().mockResolvedValue(runs);
  const repository = { createQueryBuilder: jest.fn().mockReturnValue(builder), find };
  const service = new CertificationTeamDashboardService(repository as never);
  return { service, builder, find, repository };
};

const all = () => true as const;
const g = (
  edfiTenantId: number,
  odsId: number,
  certificationModel: string,
  maxId: string | number
): GroupRow => ({ edfiTenantId, odsId, certificationModel, maxId });

describe('CertificationTeamDashboardService.getDashboard', () => {
  it('groups the latest run of each model under its data store', async () => {
    const { service } = setup(
      [g(1, 10, 'MTSS', 3), g(1, 10, 'SIS', 2), g(2, 20, 'SIS', 4)],
      [
        run(3, 'MTSS', 'DRAFT', 1, 10, { env: 'B env', tenant: 'T1', ods: 'Z' }),
        run(2, 'SIS', 'APPROVED', 1, 10, { env: 'B env', tenant: 'T1', ods: 'Z' }),
        run(4, 'SIS', 'DRAFT', 2, 20, { env: 'A env', tenant: 'T2', ods: 'Y' }),
      ]
    );
    const result = await service.getDashboard({ teamId: 7, validOdsIds: all });
    expect(result.dataStores.map((d) => d.environmentName)).toEqual(['A env', 'B env']);
    expect(result.dataStores[1]).toMatchObject({
      edfiTenantId: 1,
      odsId: 10,
      tenantName: 'T1',
      dataStoreName: 'Z',
    });
    expect(result.dataStores[1].runs.map((r) => r.certificationModel)).toEqual(['SIS', 'MTSS']);
  });

  it('only the newest run per data store and model is used', async () => {
    const { service, find } = setup([g(1, 10, 'SIS', 9)], [run(9, 'SIS', 'DRAFT', 1, 10)]);
    const result = await service.getDashboard({ teamId: 7, validOdsIds: all });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { certificationRunId: In([9]) } })
    );
    expect(result.counts.certified).toBe(0);
  });

  it('counts come from the same rows as the cards', async () => {
    const { service } = setup(
      [g(1, 10, 'SIS', 1), g(1, 10, 'MTSS', 2), g(1, 10, 'ASSESSMENTS', 3)],
      [
        run(1, 'SIS', 'DRAFT', 1, 10),
        run(2, 'MTSS', 'APPROVED', 1, 10),
        run(3, 'ASSESSMENTS', 'IN_REVIEW', 1, 10),
      ]
    );
    const { counts } = await service.getDashboard({ teamId: 7, validOdsIds: all });
    expect(counts).toEqual({ waitingOnUs: 1, readyForReview: 1, executingNow: 2, certified: 1 });
  });

  it('drops data stores the user cannot read', async () => {
    const { service, find } = setup(
      [g(1, 10, 'SIS', 1), g(2, 20, 'SIS', 2)],
      [run(2, 'SIS', 'DRAFT', 2, 20)]
    );
    const result = await service.getDashboard({
      teamId: 7,
      validOdsIds: (tenantId) => (tenantId === 2 ? new Set([20]) : undefined),
    });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { certificationRunId: In([2]) } })
    );
    expect(result.dataStores.map((d) => d.odsId)).toEqual([20]);
    expect(result.counts.waitingOnUs).toBe(1);
  });

  it('drops a data store missing from a tenant Set of ods ids', async () => {
    const { service } = setup([g(2, 20, 'SIS', 2)], []);
    const result = await service.getDashboard({ teamId: 7, validOdsIds: () => new Set([99]) });
    expect(result.dataStores).toEqual([]);
  });

  it('ignores runs without a data store', async () => {
    const { service, builder } = setup([], []);
    await service.getDashboard({ teamId: 7, validOdsIds: all });
    expect(builder.where).toHaveBeenCalledWith(
      expect.stringContaining('run.odsId IS NOT NULL'),
      expect.anything()
    );
  });

  it('returns zero counts and no data stores when the team has no runs', async () => {
    const { service, find } = setup([], []);
    await expect(service.getDashboard({ teamId: 7, validOdsIds: all })).resolves.toEqual({
      counts: { waitingOnUs: 0, readyForReview: 0, executingNow: 0, certified: 0 },
      dataStores: [],
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('queries only the given team', async () => {
    const { service, builder } = setup([], []);
    await service.getDashboard({ teamId: 42, validOdsIds: all });
    expect(builder.where).toHaveBeenCalledWith(
      expect.stringContaining('run.teamId = :teamId'),
      { teamId: 42 }
    );
  });

  it('numeric ids from either database engine', async () => {
    const { service, find } = setup(
      [g(1, 10, 'SIS', '5'), g(1, 10, 'MTSS', 6)],
      [run(5, 'SIS', 'DRAFT', 1, 10), run(6, 'MTSS', 'DRAFT', 1, 10)]
    );
    await service.getDashboard({ teamId: 7, validOdsIds: all });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { certificationRunId: In([5, 6]) } })
    );
  });
});
