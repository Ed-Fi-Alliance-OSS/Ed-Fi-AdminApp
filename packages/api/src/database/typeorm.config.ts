import {
  AppLauncher,
  Edorg,
  Ods,
  Oidc,
  Ownership,
  Privilege,
  Role,
  Sbe,
  Tenant,
  User,
  UserTenantMembership,
} from '@edanalytics/models-server';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Initial1688158300508 } from './migrations/1687190483471-initial';
import { SbeConfigReorg1687190483472 } from './migrations/1687190483472-sbe-config-reorg';
import { AdOdsNaturalKeyToEdorg1687466013005 } from './migrations/1687466013005-add-ods-natural-key-to-edorg';
import { EducationOrganizationIdToNumber1687881668666 } from './migrations/1687881668666-educationOrganizationIdToNumber';
import { UniqueOwnershipConstraints1687900131470 } from './migrations/1687900131470-uniqueOwnershipConstraints';
import { EdorgShortname1689282856860 } from './migrations/1689282856860-edorg-shortname';
import { OwnershipUniquenessSoftdelete1691010443030 } from './migrations/1691010443030-ownershipUniquenessSoftdelete';
import { AbandonSoftDeletion1691520653756 } from './migrations/1691520653756-abandonSoftDeletion';

const config: Pick<
  PostgresConnectionOptions,
  'entities' | 'synchronize' | 'migrations' | 'type' | 'migrationsRun'
> = {
  type: 'postgres',
  entities: [
    User,
    Tenant,
    Ods,
    Sbe,
    Edorg,
    UserTenantMembership,
    Privilege,
    Role,
    Ownership,
    Oidc,
    AppLauncher,
  ],
  synchronize: false,
  migrationsRun: true,
  migrations: [
    Initial1688158300508,
    SbeConfigReorg1687190483472,
    AdOdsNaturalKeyToEdorg1687466013005,
    EducationOrganizationIdToNumber1687881668666,
    UniqueOwnershipConstraints1687900131470,
    EdorgShortname1689282856860,
    OwnershipUniquenessSoftdelete1691010443030,
    AbandonSoftDeletion1691520653756,
  ],
};
export default config;
