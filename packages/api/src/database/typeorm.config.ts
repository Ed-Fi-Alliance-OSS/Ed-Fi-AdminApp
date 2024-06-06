import {
  EdfiTenant,
  Edorg,
  EnvNav,
  Ods,
  Oidc,
  Ownership,
  OwnershipView,
  Role,
  SbEnvironment,
  SbSyncQueue,
  Team,
  User,
  UserTeamMembership,
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
import { GuaranteeMembershipUniqueness1691694310950 } from './migrations/1691694310950-guaranteeMembershipUniqueness';
import { AddSeparateSbeNameField1692280869502 } from './migrations/1692280869502-AddSeparateSbeNameField';
import { NewSbSyncQueue1692740626759 } from './migrations/1692740626759-NewSbSyncQueue';
import { NullableEnvlabel1693335908870 } from './migrations/1693335908870-NullableEnvlabel';
import { FkOnDeleteTweaks1693514948085 } from './migrations/1693514948085-fkOnDeleteTweaks';
import { FkOnDeleteFix1694446892889 } from './migrations/1694446892889-FkOnDeleteFix';
import { LowercaseUniqueUsernames1697054661848 } from './migrations/1697054661848-LowercaseUniqueUsernames';
import { Seeding1697203599392 } from './migrations/1697203599392-Seeding';
import { RemoveRemainingAppLauncherThings1697207080973 } from './migrations/1697207080973-RemoveRemainingAppLauncherThings';
import { V7Changes1709328882890 } from './migrations/1709328882890-v7-changes';
import { EnvNav1710178189458 } from './migrations/1710178189458-EnvNav';
import { OdsInstanceName1710454017707 } from './migrations/1710454017707-OdsInstanceName';
import { RemoveImpliedPrivilege1714074225483 } from './migrations/1714074225483-RemoveImpliedPrivilege';
import { BigIntEdOrg1717166915117 } from './migrations/1717166915117-BigIntEdOrgId';

const config: Pick<
  PostgresConnectionOptions,
  'entities' | 'synchronize' | 'migrations' | 'type' | 'migrationsRun'
> = {
  type: 'postgres',
  entities: [
    User,
    Team,
    Ods,
    EdfiTenant,
    SbEnvironment,
    Edorg,
    UserTeamMembership,
    Role,
    Ownership,
    OwnershipView,
    Oidc,
    SbSyncQueue,
    EnvNav,
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
    GuaranteeMembershipUniqueness1691694310950,
    AddSeparateSbeNameField1692280869502,
    NewSbSyncQueue1692740626759,
    NullableEnvlabel1693335908870,
    FkOnDeleteTweaks1693514948085,
    FkOnDeleteFix1694446892889,
    LowercaseUniqueUsernames1697054661848,
    Seeding1697203599392,
    RemoveRemainingAppLauncherThings1697207080973,
    V7Changes1709328882890,
    EnvNav1710178189458,
    OdsInstanceName1710454017707,
    RemoveImpliedPrivilege1714074225483,
    BigIntEdOrg1717166915117,
  ],
};
export default config;
