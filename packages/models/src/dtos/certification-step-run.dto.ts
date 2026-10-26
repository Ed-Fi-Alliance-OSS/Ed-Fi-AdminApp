import { Expose, Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { makeSerializer } from '../utils/make-serializer';

/** SIS data standard versions Admin App can certify. Add one only after its scenarios are tested. */
export const SUPPORTED_SIS_VERSIONS = ['v5'] as const;
export type SisVersion = (typeof SUPPORTED_SIS_VERSIONS)[number];
export const isSupportedSisVersion = (version: string): version is SisVersion =>
  (SUPPORTED_SIS_VERSIONS as readonly string[]).includes(version);

export const CERT_STEP_STATUS = { success: 'success', failed: 'failed' } as const;
export type CertStepStatus = (typeof CERT_STEP_STATUS)[keyof typeof CERT_STEP_STATUS];

export const CERT_SCENARIO_STATUS = {
  inprogress: 'inprogress',
  failed: 'failed',
  completed: 'completed',
} as const;
export type CertScenarioStatus = (typeof CERT_SCENARIO_STATUS)[keyof typeof CERT_SCENARIO_STATUS];

/** Moving a process past `inprogress` (e.g. Ready for Review) belongs to AC-659. */
export const CERT_PROCESS_STATUS = { inprogress: 'inprogress' } as const;

/**
 * Body of POST .../certification/sis/:sisVersion/steps/:stepId/run.
 * The token is never persisted or logged. Input keys and values are checked
 * against the step's catalog parameters in the service.
 */
export class PostCertificationStepRunDto {
  @Expose()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  odsId?: number;

  @Expose()
  @IsString()
  @Matches(/^[\x21-\x7E]{1,4096}$/, { message: 'token must be 1-4096 visible ASCII characters' })
  token: string;

  @Expose()
  @IsObject()
  inputs: Record<string, string>;
}

export class CertificationStepRunErrorDto {
  @Expose()
  property: string;

  @Expose()
  validation: string;

  @Expose()
  error: string;
}

export class CertificationStepRunDto {
  @Expose()
  stepId: number;

  @Expose()
  status: CertStepStatus;

  /** ISO 8601 instant the step ran. */
  @Expose()
  ranAt: string;

  @Expose()
  scenarioStatus: CertScenarioStatus;

  @Expose()
  @Type(() => CertificationStepRunErrorDto)
  errors: CertificationStepRunErrorDto[];
}

export const toCertificationStepRunDto = makeSerializer<
  CertificationStepRunDto,
  CertificationStepRunDto
>(CertificationStepRunDto);

/** The last saved result of one step, as read back by GET .../step-runs (AC-475). */
export class CertificationSavedStepRunDto {
  @Expose()
  stepId: number;

  @Expose()
  status: CertStepStatus;

  /** ISO 8601 instant the step ran. */
  @Expose()
  ranAt: string;

  /** The values the vendor typed, keyed by parameter name; used to prefill a re-run. */
  @Expose()
  inputs: Record<string, string> | null;

  @Expose()
  @Type(() => CertificationStepRunErrorDto)
  errors: CertificationStepRunErrorDto[];
}

/** Saved results of one scenario's steps; steps that never ran are left out. */
export class CertificationStepRunsDto {
  @Expose()
  scenarioStatus: CertScenarioStatus | null;

  @Expose()
  @Type(() => CertificationSavedStepRunDto)
  steps: CertificationSavedStepRunDto[];
}

export const toCertificationStepRunsDto = makeSerializer<
  CertificationStepRunsDto,
  CertificationStepRunsDto
>(CertificationStepRunsDto);

/** One scenario's saved status, as read back by GET .../scenario-statuses. */
export class CertificationScenarioStatusDto {
  @Expose()
  scenarioId: number;

  @Expose()
  status: CertScenarioStatus;
}

export const toCertificationScenarioStatusDto = makeSerializer<
  CertificationScenarioStatusDto,
  CertificationScenarioStatusDto
>(CertificationScenarioStatusDto);
