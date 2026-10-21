import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import * as config from 'config';

/** One audit trail entry. Deliberately has no relations so entries outlive the rows they describe. */
@Entity({ name: 'audit_log' })
export class AuditLog {
  // bigint comes back from the driver as a string.
  // 'increment' (not 'identity') makes TypeORM leave the column out of INSERTs; with 'identity'
  // it sends DEFAULT, which SQL Server rejects for an identity column. The migrations own the DDL.
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 30 })
  eventType: string;

  @Index('IDX_audit_log_timestamp')
  // An absolute instant with its offset on both engines, so it never depends on the host time zone
  @Column({ type: config.DB_ENGINE === 'pgsql' ? 'timestamptz' : 'datetimeoffset' })
  timestamp: Date;

  @Index('IDX_audit_log_actorUsername')
  @Column({ type: 'varchar', length: 256, nullable: true })
  actorUsername: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorType: 'user' | 'machine' | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  sourceIpAddress: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  httpVerb: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  httpUrl: string | null;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  oidcId: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;
}
