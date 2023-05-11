import {
  User,
  Tenant,
  Resource,
  Ods,
  Sbe,
  Edorg,
  UserTenantMembership,
  Privilege,
  Role,
  Ownership,
} from '@edanalytics/models-server';
import { DataSourceOptions } from 'typeorm';

const config: DataSourceOptions = {
  type: 'sqlite',
  database: 'packages/api/db.sqlite',
  entities: [
    User,
    Tenant,
    Resource,
    Ods,
    Sbe,
    Edorg,
    UserTenantMembership,
    Privilege,
    Role,
    Ownership,
  ],
  synchronize: true,
  migrations: ['packages/api/src/database/migrations/*.{ts,js}'],
  // logging: ["query"]
};

export default config;
