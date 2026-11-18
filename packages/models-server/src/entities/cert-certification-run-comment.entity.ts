import { CertReviewDecision } from '@edanalytics/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import * as config from 'config';
import { CertificationRun } from './cert-certification-run.entity';
import { User } from './user.entity';

/**
 * One review decision on a certification run, with the reviewer's comment.
 * The author FK is SET NULL on pgsql and NO ACTION on mssql (see CertificationReview1794000000005).
 */
@Index('IDX_cert_certification_run_comment_run', ['certificationRunId'])
@Entity({ schema: 'cert', name: 'certification_run_comment' })
export class CertificationRunComment {
  @PrimaryGeneratedColumn()
  certificationRunCommentId: number;

  @ManyToOne(() => CertificationRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationRunId' })
  certificationRun: CertificationRun;

  @Column()
  certificationRunId: number;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  /** Null once its author's user was deleted. */
  @Column({ type: 'int', nullable: true })
  authorId: number | null;

  @Column({ type: 'varchar', length: 50 })
  decision: CertReviewDecision;

  @Column({
    type: config.DB_ENGINE === 'pgsql' ? 'text' : 'nvarchar',
    length: config.DB_ENGINE === 'pgsql' ? undefined : 'MAX',
    nullable: true,
  })
  text: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
