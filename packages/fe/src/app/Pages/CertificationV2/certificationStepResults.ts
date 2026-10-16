import { CertificationStepParameterDto, CertStepStatus } from '@edanalytics/models';
import { isUserInputParameter } from './certificationCatalog';

export type StepDisplayStatus = 'notExecuted' | 'running' | 'success' | 'failed';

/**
 * The one place a step status gets its label and colours. New states (such as
 * "Environment unreachable" in AC-654) are added here only.
 */
export const STEP_STATUS_DISPLAY: Record<
  StepDisplayStatus,
  { label: string; textColor: string; dotColor: string }
> = {
  notExecuted: { label: 'Not executed', textColor: 'gray.600', dotColor: 'gray.400' },
  running: { label: 'Running', textColor: 'blue.600', dotColor: 'blue.500' },
  success: { label: 'Successful', textColor: 'green.600', dotColor: 'green.500' },
  failed: { label: 'Failed', textColor: 'red.600', dotColor: 'red.500' },
};

/** An unknown saved status shows as failed: it must never look like a pass. */
export const toDisplayStatus = (
  saved: CertStepStatus | undefined,
  isRunning: boolean,
): StepDisplayStatus => {
  if (isRunning) return 'running';
  if (saved === undefined) return 'notExecuted';
  return saved === 'success' ? 'success' : 'failed';
};

/** The run API's `inputs`: typed values of `input` parameters, keyed by parameter name. */
export const toRunInputs = (
  parameters: CertificationStepParameterDto[],
  valuesById: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    parameters
      .filter(isUserInputParameter)
      .map((parameter) => [parameter.name, (valuesById[parameter.parameterId] ?? '').trim()]),
  );

/** Field values keyed by parameter ID, prefilled from a saved run's inputs (keyed by name). */
export const toParameterValues = (
  parameters: CertificationStepParameterDto[],
  savedInputs: Record<string, string> | null | undefined,
): Record<string, string> =>
  Object.fromEntries(
    parameters
      .filter(isUserInputParameter)
      .map((parameter) => [String(parameter.parameterId), savedInputs?.[parameter.name] ?? '']),
  );

export const STEP_NOT_FOUND_MESSAGE =
  'This step is no longer in the active certification catalog. The list has been reloaded.';

export type RunErrorKind =
  { kind: 'api'; message: string; notFound: boolean } | { kind: 'unknown' };

/**
 * The API client throws only the response body, so the API's own errors are told apart by
 * their shape. Anything else (a proxy's HTML page, a dropped connection) is unknown: the run
 * may still have finished and been saved.
 */
export const classifyRunError = (error: unknown): RunErrorKind => {
  if (typeof error !== 'object' || error === null) return { kind: 'unknown' };
  const body = error as {
    data?: { errors?: Record<string, { message?: string }> };
    statusCode?: unknown;
    message?: unknown;
  };

  const validationMessage =
    body.data?.errors && Object.values(body.data.errors).find((e) => e?.message)?.message;
  if (validationMessage) return { kind: 'api', message: validationMessage, notFound: false };

  if (typeof body.statusCode === 'number') {
    if (body.statusCode === 404) {
      return { kind: 'api', message: STEP_NOT_FOUND_MESSAGE, notFound: true };
    }
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof message === 'string' && message) {
      return { kind: 'api', message, notFound: false };
    }
  }
  return { kind: 'unknown' };
};
