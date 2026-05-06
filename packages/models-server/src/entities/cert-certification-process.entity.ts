import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CatalogVersion } from './cert-catalog-version.entity';
import { CertificationOdsApi } from './cert-certification-ods-api.entity';

@Entity({ schema: 'cert', name: 'certification_process' })
export class CertificationProcess {
  @PrimaryGeneratedColumn()
  certificationProcessId: number;

  @ManyToOne(() => CertificationOdsApi, { onDelete: 'CASCADE' })
  ods: CertificationOdsApi;

  @Column()
  odsId: number;

  @ManyToOne(() => CatalogVersion, { onDelete: 'RESTRICT' })
  catalogVersion: CatalogVersion;

  @Column()
  catalogVersionId: number;

  @Column({ type: 'character varying', length: 50 })
  status: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
