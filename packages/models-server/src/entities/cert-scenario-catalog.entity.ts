import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DomainCatalog } from './cert-domain-catalog.entity';

@Entity({ schema: 'cert', name: 'scenario_catalog' })
export class ScenarioCatalog {
  @PrimaryGeneratedColumn()
  scenarioId: number;

  @ManyToOne(() => DomainCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domainId' })
  domain: DomainCatalog;

  @Column()
  domainId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  @Column()
  displayOrder: number;

  @Column({ default: true })
  isEnabled: boolean;
}
