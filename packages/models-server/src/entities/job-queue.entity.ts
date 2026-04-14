// Note: The singletonKey filtered unique index is created via raw migration SQL (D-11).
// Do NOT add an @Index decorator for filtered/conditional indexes on MSSQL — TypeORM DDL
// generation for filtered WHERE clauses is unreliable across SQL Server versions.
// Full column set will be added in Phase 2 (T2-01).
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('job_queue')
@Index(['name', 'state'])
export class JobQueue {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'created' })
  state: string;
}
