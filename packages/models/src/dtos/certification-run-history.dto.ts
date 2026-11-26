import { Expose } from 'class-transformer';
import { makeSerializer } from '../utils/make-serializer';
import type { CertModel, CertRunStatus } from './certification-run.dto';

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

  @Expose()
  createdAt: string;

  @Expose()
  completedScenarios: number;

  @Expose()
  totalScenarios: number;
}

export const toCertificationRunHistoryDto = makeSerializer<
  CertificationRunHistoryRowDto,
  CertificationRunHistoryRowDto
>(CertificationRunHistoryRowDto);
