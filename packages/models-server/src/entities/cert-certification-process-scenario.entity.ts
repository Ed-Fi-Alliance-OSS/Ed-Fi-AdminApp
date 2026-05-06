import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { CertificationProcess } from './cert-certification-process.entity';
import { ScenarioCatalog } from './cert-scenario-catalog.entity';

@Entity({ schema: 'cert', name: 'certification_process_scenario' })
export class CertificationProcessScenario {
  @PrimaryColumn()
  certificationProcessId: number;

  @PrimaryColumn()
  scenarioId: number;

  @ManyToOne(() => CertificationProcess, { onDelete: 'CASCADE' })
  certificationProcess: CertificationProcess;

  @ManyToOne(() => ScenarioCatalog, { onDelete: 'CASCADE' })
  scenario: ScenarioCatalog;

  @Column({ type: 'character varying', length: 50 })
  status: string;
}
