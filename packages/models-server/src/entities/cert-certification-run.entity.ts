import { CertModel, CertRunStatus } from '@edanalytics/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogVersion } from './cert-catalog-version.entity';
import { EdfiTenant } from './edfi-tenant.entity';
import { Ods } from './ods.entity';
import { Team } from './team.entity';
import { User } from './user.entity';

/**
 * One certification run of one Certification Model on one data store (tenant + ODS).
 * A data store has at most one open run per model; open means not Approved or Rejected.
 * The two partial unique indexes that enforce it are created by migration 1794000000000; they
 * are declared here with synchronize disabled only so `migrations:generate` doesn't emit a
 * DROP INDEX for them.
 */
@Index('UQ_cert_certification_run_open_ods', { synchronize: false })
@Index('UQ_cert_certification_run_open_no_ods', { synchronize: false })
@Entity({ schema: 'cert', name: 'certification_run' })
export class CertificationRun {
  @PrimaryGeneratedColumn()
  certificationRunId: number;

  @ManyToOne('EdfiTenant', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'edfiTenantId' })
  edfiTenant: EdfiTenant;

  @Column()
  edfiTenantId: number;

  // The DB constraint is CASCADE on pgsql and NO ACTION on mssql (see CertificationRuns1794000000000).
  @ManyToOne('Ods', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'odsId' })
  ods: Ods | null;

  @Column({ type: 'int', nullable: true })
  odsId: number | null;

  @Column({ type: 'varchar', length: 50 })
  certificationModel: CertModel;

  /** The catalog version the run was created with; null for a model without a Bruno catalog. */
  @ManyToOne(() => CatalogVersion, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'catalogVersionId' })
  catalogVersion: CatalogVersion | null;

  @Column({ type: 'int', nullable: true })
  catalogVersionId: number | null;

  // SET NULL on pgsql and NO ACTION on mssql, for teamId and createdById.
  @ManyToOne('Team', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  /** The team that started the run. Null for a run from before AC-651, or whose team was deleted. */
  @Column({ type: 'int', nullable: true })
  teamId: number | null;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  /** The workflow status (CERT_RUN_STATUS), not a result: results live on the scenario and step rows. */
  @Column({ type: 'varchar', length: 50 })
  status: CertRunStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
