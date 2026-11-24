import { Expose } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import type { CertModel, CertRunStatus } from './certification-run.dto';

/** One row of a team's Run history: a run, where it ran, and how far its scenarios have got. */
export class CertificationRunHistoryRowDto {
  @Expose()
  runId: number;

  @Expose()
  edfiTenantId: number;

  @Expose()
  odsId: number;

  @Expose()
  environmentName: string;

  @Expose()
  tenantName: string;

  @Expose()
  dataStoreName: string;

  @Expose()
  certificationModel: CertModel;

  @Expose()
  status: CertRunStatus;

  /** ISO timestamp of when the run was started. */
  @Expose()
  createdAt: string;

  /** Enabled scenarios of the run's catalog that have completed. */
  @Expose()
  completedScenarios: number;

  /** Enabled scenarios of the run's catalog; 0 for a run without a catalog. */
  @Expose()
  totalScenarios: number;
}

export const toCertificationRunHistoryDto = makeSerializer<
  CertificationRunHistoryRowDto,
  CertificationRunHistoryRowDto
>(CertificationRunHistoryRowDto);
