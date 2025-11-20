import { IOidc } from '@edanalytics/models';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Oidc implements IOidc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  issuer: string;

  @Column()
  clientId: string;

  @Column()
  clientSecret: string;

  @Column()
  scope: string;
}
