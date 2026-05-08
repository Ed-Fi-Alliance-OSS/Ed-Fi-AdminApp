import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CertificationProcess } from './cert-certification-process.entity';
import { ScenarioCatalog } from './cert-scenario-catalog.entity';
import { StepCatalog } from './cert-step-catalog.entity';

@Entity({ schema: 'cert', name: 'scenario_step' })
export class ScenarioStep {
  @PrimaryGeneratedColumn()
  stepRunId: number;

  @ManyToOne(() => CertificationProcess, { onDelete: 'CASCADE' })
  certificationProcess: CertificationProcess;

  @Column()
  certificationProcessId: number;

  @ManyToOne(() => ScenarioCatalog, { onDelete: 'RESTRICT' })
  scenario: ScenarioCatalog;

  @Column()
  scenarioId: number;

  @ManyToOne(() => StepCatalog, { onDelete: 'RESTRICT' })
  step: StepCatalog;

  @Column()
  stepId: number;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ nullable: true })
  runAt: Date | null;
}
