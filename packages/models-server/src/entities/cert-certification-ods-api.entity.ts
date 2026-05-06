import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'cert', name: 'certification_ods_api' })
export class CertificationOdsApi {
  @PrimaryGeneratedColumn()
  odsId: number;

  @Column({ type: 'character varying', length: 2048 })
  odsUrl: string;

  @Column({ type: 'character varying', length: 255 })
  clientId: string;
}
