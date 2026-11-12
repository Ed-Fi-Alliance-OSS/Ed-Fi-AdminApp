import * as config from 'config';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CertificationRun } from './cert-certification-run.entity';
import { ScenarioCatalog } from './cert-scenario-catalog.entity';

@Entity({ schema: 'cert', name: 'certification_run_scenario' })
export class CertificationRunScenario {
  @PrimaryColumn()
  certificationRunId: number;

  @PrimaryColumn()
  scenarioId: number;

  @ManyToOne(() => CertificationRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationRunId' })
  certificationRun: CertificationRun;

  @ManyToOne(() => ScenarioCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioId' })
  scenario: ScenarioCatalog;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  /**
   * Bruno runtime variables captured by this scenario's steps, restored into its next run.
   * Stored as plaintext on purpose (AC-466 D4): certification ODSs hold synthetic data.
   */
  @Column({ type: config.DB_ENGINE === 'pgsql' ? 'jsonb' : 'simple-json', nullable: true })
  capturedVars: Record<string, string | number | boolean | null> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
