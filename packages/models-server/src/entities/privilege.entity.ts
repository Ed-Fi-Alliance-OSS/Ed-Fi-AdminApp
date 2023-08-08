import { IPrivilege, PrivilegeCode } from '@edanalytics/models';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Privilege implements IPrivilege {
  @Column()
  name: string;
  @Column()
  description: string;
  @PrimaryColumn({ type: 'varchar' })
  code: PrivilegeCode;

  get displayName() {
    return this.name;
  }
}
