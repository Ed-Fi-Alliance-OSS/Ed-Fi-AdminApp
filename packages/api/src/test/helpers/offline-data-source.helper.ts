import type { DataSource } from 'typeorm';

export type DbEngine = 'pgsql' | 'mssql';

type ModelsServer = typeof import('@edanalytics/models-server');

/**
 * Builds real TypeORM entity metadata for one database engine without connecting to a database,
 * so tests can generate the exact SQL that engine would receive.
 *
 * Some entities pick column types from `config.DB_ENGINE` when their module loads, so the entities
 * are loaded in an isolated module registry with that engine configured.
 */
export const buildOfflineDataSource = async (
  engine: DbEngine,
  pickEntities: (models: ModelsServer) => unknown[],
): Promise<{ dataSource: DataSource; models: ModelsServer }> => {
  let models!: ModelsServer;
  let typeorm!: typeof import('typeorm');
  jest.isolateModules(() => {
    jest.doMock('config', () => ({ ...jest.requireActual('config'), DB_ENGINE: engine }));
    typeorm = require('typeorm');
    models = require('@edanalytics/models-server');
  });
  const dataSource = new typeorm.DataSource({
    ...(engine === 'mssql'
      ? { type: 'mssql' as const, options: { trustServerCertificate: true } }
      : { type: 'postgres' as const }),
    host: 'offline.invalid',
    username: 'offline',
    password: 'offline',
    database: 'offline',
    entities: pickEntities(models) as never,
  });
  // DataSource.initialize() would connect; building the metadata is the only part these tests need.
  await (dataSource as unknown as { buildMetadatas: () => Promise<void> }).buildMetadatas();
  return { dataSource, models };
};
