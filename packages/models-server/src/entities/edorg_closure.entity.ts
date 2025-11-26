import { IEdOrgClosure } from '@edanalytics/models';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('edorg_closure')
export class EdOrgClosure implements IEdOrgClosure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_ancestor: number;

  @Column()
  id_descendant: number;
}
