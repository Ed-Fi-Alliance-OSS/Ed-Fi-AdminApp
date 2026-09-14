import 'reflect-metadata';
import { StartingBlocksServiceV1 } from './starting-blocks.v1.service';

describe('StartingBlocksServiceV1.syncTenantResourceTree', () => {
  it('loads the SbEnvironment with the { edfiTenants: true } relations shape TypeORM 1.1.0 requires', async () => {
    const sbEnvironmentsRepository = {
      findOne: jest.fn().mockResolvedValue({ edfiTenants: [{}, {}] }),
    };
    const service = new StartingBlocksServiceV1(
      {} as never,
      sbEnvironmentsRepository as never,
      {} as never,
    );

    const result = await service.syncTenantResourceTree(
      { sbEnvironmentId: 7 } as never,
      {} as never,
    );

    expect(sbEnvironmentsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 7 },
      relations: { edfiTenants: true },
    });
    // Guard clause below the relations load, reached only if the query resolved correctly
    expect(result).toEqual({ status: 'INVALID_ENVIRONMENT_TENANTS' });
  });
});
