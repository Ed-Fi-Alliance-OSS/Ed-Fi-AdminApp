import * as fs from 'fs';
import { CAPTURE_VARS_FILE, RESTORE_VARS_FILE } from './bridge-requests';
import { CapturedVars, sanitizeCapturedVars } from './captured-vars';

export interface StepRunError {
  property: string;
  validation: string;
  error: string;
}

export interface ParsedBrunoReport {
  /** False when the run didn't finish, so its results (and captured values) can't be trusted. */
  complete: boolean;
  passed: boolean;
  errors: StepRunError[];
  /** Runtime variables after the step ran; null when unavailable (leave the stored ones alone). */
  capturedVars: CapturedVars | null;
  /** Keys (never values) of a capture body that failed validation, capped; null when nothing was rejected. */
  capturedVarsRejectedKeys: string[] | null;
}

export const INCOMPLETE_RUN_MESSAGE =
  "The step didn't finish. Check that the Ed-Fi API is reachable and try again.";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_PROPERTY_LENGTH = 500;
const MAX_REJECTED_KEYS = 50;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

interface ReportTest {
  description?: string;
  status?: string;
  error?: unknown;
  isScriptError?: boolean;
}

interface ReportAssertion {
  lhsExpr?: string;
  rhsExpr?: string;
  status?: string;
  error?: unknown;
}

interface ReportResult {
  test?: { filename?: string };
  request?: { data?: unknown };
  error?: unknown;
  status?: string;
  skipped?: boolean;
  assertionResults?: ReportAssertion[];
  testResults?: ReportTest[];
  preRequestTestResults?: ReportTest[];
  postResponseTestResults?: ReportTest[];
}

/** Strips ANSI codes, redacts the token and caps the length before anything is stored. */
export const cleanMessage = (message: unknown, token: string, maxLength = MAX_MESSAGE_LENGTH): string => {
  let text = typeof message === 'string' ? message : JSON.stringify(message ?? '');
  text = text.replace(ANSI_PATTERN, '');
  if (token) text = text.split(token).join('[REDACTED]');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export const incompleteRunReport = (): ParsedBrunoReport => ({
  complete: false,
  passed: false,
  errors: [{ property: '', validation: 'run', error: INCOMPLETE_RUN_MESSAGE }],
  capturedVars: null,
  capturedVarsRejectedKeys: null,
});

const normalizePath = (filename?: string): string => (filename ?? '').split('\\').join('/');

type CapturedVarsReading = Pick<ParsedBrunoReport, 'capturedVars' | 'capturedVarsRejectedKeys'>;

/**
 * Captured values are only trusted when the capture request ran cleanly (like the restore check).
 * A failed capture reports {} and would wipe the stored values, so it returns null instead.
 */
const readCapturedVars = (capture?: ReportResult): CapturedVarsReading => {
  const none: CapturedVarsReading = { capturedVars: null, capturedVarsRejectedKeys: null };
  if (!capture || capture.error || capture.status !== 'skipped') return none;
  const data = capture.request?.data;
  if (typeof data !== 'string') return none;
  try {
    const parsed: unknown = JSON.parse(data);
    const capturedVars = sanitizeCapturedVars(parsed);
    if (capturedVars) return { capturedVars, capturedVarsRejectedKeys: null };
    const keys =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.keys(parsed).slice(0, MAX_REJECTED_KEYS)
        : [];
    return { capturedVars: null, capturedVarsRejectedKeys: keys };
  } catch {
    return none;
  }
};

/**
 * Turns Bruno's JSON report into the step's verdict. A request whose own `status` is
 * `pass` can still have failed tests, so the verdict comes from errors, assertions and tests.
 */
export const parseBrunoReport = (
  report: unknown,
  { stepPath, token }: { stepPath: string; token: string }
): ParsedBrunoReport => {
  const iteration = Array.isArray(report) ? report[0] : undefined;
  const results: ReportResult[] = Array.isArray(iteration?.results) ? iteration.results : [];
  const find = (relativePath: string) =>
    results.find((result) => normalizePath(result.test?.filename) === relativePath);

  const restore = find(RESTORE_VARS_FILE);
  const step = find(stepPath);
  // If restore failed, capture would report {} and wipe good values: treat as incomplete.
  if (!step || !restore || restore.error || restore.status !== 'skipped') {
    return incompleteRunReport();
  }

  const errors: StepRunError[] = [];
  if (step.skipped) {
    errors.push({ property: '', validation: 'script', error: 'The step was skipped.' });
  }
  if (step.error) {
    errors.push({ property: '', validation: 'script', error: cleanMessage(step.error, token) });
  }
  for (const assertion of step.assertionResults ?? []) {
    if (assertion.status === 'pass') continue;
    errors.push({
      property: cleanMessage(assertion.lhsExpr ?? '', token, MAX_PROPERTY_LENGTH),
      validation: cleanMessage(assertion.rhsExpr ?? '', token),
      error: cleanMessage(assertion.error, token),
    });
  }
  const tests = [
    ...(step.preRequestTestResults ?? []),
    ...(step.testResults ?? []),
    ...(step.postResponseTestResults ?? []),
  ];
  for (const test of tests) {
    if (test.status === 'pass') continue;
    errors.push(
      test.isScriptError
        ? { property: '', validation: 'script', error: cleanMessage(test.error, token) }
        : {
            property: cleanMessage(test.description ?? '', token, MAX_PROPERTY_LENGTH),
            validation: 'test',
            error: cleanMessage(test.error, token),
          }
    );
  }

  return {
    complete: true,
    passed: errors.length === 0,
    errors,
    ...readCapturedVars(find(CAPTURE_VARS_FILE)),
  };
};

/** Reads report.json; null when Bruno never wrote it or it isn't JSON. */
export const readBrunoReport = async (reportPath: string): Promise<unknown> => {
  try {
    return JSON.parse(await fs.promises.readFile(reportPath, 'utf8'));
  } catch {
    return null;
  }
};
