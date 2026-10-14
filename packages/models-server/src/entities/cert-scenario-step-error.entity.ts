import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ScenarioStep } from './cert-scenario-step.entity';

@Entity({ schema: 'cert', name: 'scenario_step_error' })
export class ScenarioStepError {
  @PrimaryGeneratedColumn()
  errorId: number;

  @ManyToOne(() => ScenarioStep, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepRunId' })
  stepRun: ScenarioStep;

  @Column()
  stepRunId: number;

  /** What failed: an assertion expression, a test name, or '' for a script error. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  property: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  validation: string | null;
}
