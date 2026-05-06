import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'cert', name: 'catalog_version' })
export class CatalogVersion {
  @PrimaryGeneratedColumn()
  catalogVersionId: number;

  @Column({ type: 'character varying', length: 255 })
  artifactVersion: string;

  @Column({ type: 'character varying', length: 10 })
  dataStandardVersion: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  importedAt: Date;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;
}
