import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AreaCatalog } from './cert-area-catalog.entity';

@Entity({ schema: 'cert', name: 'scenario_catalog' })
export class ScenarioCatalog {
  @PrimaryGeneratedColumn()
  scenarioId: number;

  @ManyToOne(() => AreaCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'areaId' })
  area: AreaCatalog;

  @Column()
  areaId: number;

  @Column({ type: 'character varying', length: 255 })
  name: string;

  @Column({ type: 'character varying', length: 255, nullable: true })
  displayName: string | null;

  @Column()
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;
}
