import { DataSource } from 'typeorm';
import typeormConfig from './typeorm.config';
import config from 'config';

if (typeof config.DB_CONNECTION_STRING !== 'string') {
  throw new Error('Attempting to generate migration with async data source');
}

export default new DataSource({
  ...typeormConfig,
  synchronize: false,
  url: config.DB_CONNECTION_STRING,
});
