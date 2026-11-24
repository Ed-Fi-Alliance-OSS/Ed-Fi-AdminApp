import { CertRunEvent, CertRunStatus } from '@edanalytics/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CertificationRunComment } from './cert-certification-run-comment.entity';
import { CertificationRun } from './cert-certification-run.entity';

/**
 * One entry in the append-only audit history of a certification run: a real status change.
 * Rows are only inserted, never updated or deleted; the run FK cascade is the only thing that
 * removes them. `userId` deliberately has no FK to User, so a deleted user's entries never
 * change (null means the system acted).
 */
@Index('IDX_cert_certification_run_event_run', ['certificationRunId', 'certificationRunEventId'])
@Entity({ schema: 'cert', name: 'certification_run_event' })
export class CertificationRunEvent {
  @PrimaryGeneratedColumn()
  certificationRunEventId: number;

  @ManyToOne(() => CertificationRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationRunId' })
  certificationRun: CertificationRun;

  @Column()
  certificationRunId: number;

  @Column({ type: 'varchar', length: 50 })
  event: CertRunEvent;

  /** Null when the entry records the run's creation. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  fromStatus: CertRunStatus | null;

  @Column({ type: 'varchar', length: 50 })
  toStatus: CertRunStatus;

  @Column({ type: 'int', nullable: true })
  catalogVersionId: number | null;

  /** Null when the system acted. Not a FK: see the class comment. */
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => CertificationRunComment, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'certificationRunCommentId' })
  comment: CertificationRunComment | null;

  @Column({ type: 'int', nullable: true })
  certificationRunCommentId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
