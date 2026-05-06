import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StepCatalog } from './cert-step-catalog.entity';

@Entity({ schema: 'cert', name: 'step_parameter_catalog' })
export class StepParameterCatalog {
  @PrimaryGeneratedColumn()
  parameterId: number;

  @ManyToOne(() => StepCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepId' })
  step: StepCatalog;

  @Column()
  stepId: number;

  @Column({ type: 'character varying', length: 100 })
  type: string;

  @Column({ type: 'character varying', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
