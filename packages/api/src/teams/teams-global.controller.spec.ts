import 'reflect-metadata';
import { AuthorizationCache } from '@edanalytics/models';
import { EnvNav, SbEnvironment } from '@edanalytics/models-server';
import { TeamsGlobalController } from './teams-global.controller';

const envNav = (
  sbEnvironmentId: number,
  edfiTenantId: number | null,
  edfiTenantName: string | null = null,
): EnvNav => ({
  sbEnvironmentId,
  sbEnvironmentName: `env${sbEnvironmentId}`,
  edfiTenantId,
  edfiTenantName,
});

const sbEnvironment = (id: number, configPublic: SbEnvironment['configPublic']) =>
  Object.assign(new SbEnvironment(), { id, configPublic });

describe('TeamsGlobalController.envNav', () => {
  let controller: TeamsGlobalController;
  let envNavRepository: { find: jest.Mock };
  let sbEnvironmentsRepository: { find: jest.Mock };

  beforeEach(() => {
    envNavRepository = { find: jest.fn() };
    sbEnvironmentsRepository = { find: jest.fn() };
    controller = new TeamsGlobalController(
      undefined as never,
      undefined as never,
      envNavRepository as never,
      sbEnvironmentsRepository as never,
    );
  });

  it('adds each row its environment version from configPublic', async () => {
    envNavRepository.find.mockResolvedValue([
      envNav(10, 100, 'tenantv3'),
      envNav(20, 200, 'tenantv2'),
      envNav(30, null),
    ]);
    sbEnvironmentsRepository.find.mockResolvedValue([
      sbEnvironment(10, { version: 'v3' } as SbEnvironment['configPublic']),
      sbEnvironment(20, { version: 'v2' } as SbEnvironment['configPublic']),
      sbEnvironment(30, null),
    ]);

    const result = await controller.envNav({
      'team.sb-environment:read': true,
    } as AuthorizationCache);

    expect(result.map((row) => [row.sbEnvironmentId, row.version])).toEqual([
      [10, 'v3'],
      [20, 'v2'],
      [30, undefined],
    ]);
    expect(sbEnvironmentsRepository.find).toHaveBeenCalledTimes(1);
    expect(sbEnvironmentsRepository.find.mock.calls[0][0].where.id.value).toEqual([10, 20, 30]);
  });

  it('skips the environment lookup when there are no rows', async () => {
    envNavRepository.find.mockResolvedValue([]);

    const result = await controller.envNav({
      'team.sb-environment:read': true,
    } as AuthorizationCache);

    expect(result).toEqual([]);
    expect(sbEnvironmentsRepository.find).not.toHaveBeenCalled();
  });

  describe('certifications flag', () => {
    const CERT = 'team.sb-environment.edfi-tenant.ods.certification:read';

    beforeEach(() => {
      envNavRepository.find.mockResolvedValue([
        envNav(10, 100, 'granted'),
        envNav(10, 200, 'denied'),
        envNav(30, null),
      ]);
      sbEnvironmentsRepository.find.mockResolvedValue([]);
    });

    it('is true only for tenants where the user holds certification read', async () => {
      const result = await controller.envNav({
        'team.sb-environment:read': true,
        [CERT]: { 100: new Set(['__all__']) },
      } as unknown as AuthorizationCache);

      expect(result.map((row) => [row.edfiTenantId, row.certifications])).toEqual([
        [100, true],
        [200, false],
        [null, false],
      ]);
    });

    it('is false everywhere when the user has no certification privilege', async () => {
      const result = await controller.envNav({
        'team.sb-environment:read': true,
      } as AuthorizationCache);

      expect(result.every((row) => row.certifications === false)).toBe(true);
    });
  });
});
