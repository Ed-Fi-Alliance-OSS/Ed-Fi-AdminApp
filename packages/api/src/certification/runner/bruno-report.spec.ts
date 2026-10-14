import * as fs from 'fs';
import * as path from 'path';
import {
  cleanMessage,
  INCOMPLETE_RUN_MESSAGE,
  incompleteRunReport,
  parseBrunoReport,
} from './bruno-report';

const load = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', `${name}.json`), 'utf8'));

const STEP_01 = 'v5/Student/Students/01 - 1st Student is valid.bru';
const STEP_03 = 'v5/Student/Students/03 - 1st Student - birthDate was Updated.bru';
const CAPTURED = {
  firstStudentUniqueId: 'abc123',
  firstStudentId: 'S1',
  firstStudentBirthDate: '2010-01-01',
  firstStudentBirthCity: 'Austin',
};
const TOKEN = 'tok-123';

describe('parseBrunoReport', () => {
  it('passes a step whose assertions and tests all pass, and returns captured values', () => {
    expect(parseBrunoReport(load('step-passed'), { stepPath: STEP_01, token: TOKEN })).toEqual({
      complete: true,
      passed: true,
      errors: [],
      capturedVars: CAPTURED,
      capturedVarsRejectedKeys: null,
    });
  });

  it('reports a script error, such as a missing dependency', () => {
    const result = parseBrunoReport(load('script-error'), { stepPath: STEP_03, token: TOKEN });
    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ property: '', validation: 'script' });
    expect(result.errors[0].error).toMatch(/^Run "01 - 1st Student is valid" first/);
    expect(result.capturedVars).toEqual({});
  });

  it('fails a step whose request passed but whose post-response test failed (Windows paths)', () => {
    expect(parseBrunoReport(load('test-failed'), { stepPath: STEP_03, token: TOKEN })).toEqual({
      complete: true,
      passed: false,
      errors: [
        {
          property: 'birthDate changed',
          validation: 'test',
          error: "expected '2010-01-01' to not equal '2010-01-01'",
        },
      ],
      capturedVars: CAPTURED,
      capturedVarsRejectedKeys: null,
    });
  });

  it('reports failed assertions and post-response script errors', () => {
    const result = parseBrunoReport(load('assertion-failed'), { stepPath: STEP_01, token: TOKEN });
    expect(result.passed).toBe(false);
    expect(result.errors).toEqual([
      { property: 'res.body', validation: 'isNotEmpty', error: 'expected [] not to be empty' },
      {
        property: 'res.body[0].id',
        validation: 'isString',
        error: "expected { name: 'TypeError', …(2) } to be a string",
      },
      {
        property: '',
        validation: 'script',
        error:
          'No Student found, or multiple records were returned. Check your parameters and try again.',
      },
    ]);
    expect(result.capturedVars).toEqual({});
  });

  it('treats a missing report as an incomplete run', () => {
    expect(parseBrunoReport(null, { stepPath: STEP_01, token: TOKEN })).toEqual(
      incompleteRunReport(),
    );
  });

  it('treats a report without the step as an incomplete run', () => {
    expect(
      parseBrunoReport(load('step-passed'), { stepPath: 'v5/Other/x.bru', token: TOKEN }).complete,
    ).toBe(false);
  });

  it('treats a failed restore as an incomplete run, so good values are never wiped', () => {
    const report = load('step-passed');
    report[0].results[0].status = 'error';
    report[0].results[0].error = 'restore failed';
    expect(parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN }).complete).toBe(false);
  });

  it('returns null captured values when the capture body is not valid JSON', () => {
    const report = load('step-passed');
    report[0].results[2].request.data = 'not json';
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result).toMatchObject({ complete: true, passed: true, capturedVars: null });
  });

  it('ignores captured values when the capture request itself failed, so stored values survive', () => {
    const report = load('step-passed');
    report[0].results[2].status = 'error';
    report[0].results[2].error = 'boom';
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result).toMatchObject({ complete: true, passed: true, capturedVars: null });
  });

  it('ignores captured values when the capture request is missing', () => {
    const report = load('step-passed');
    report[0].results.splice(2, 1);
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result).toMatchObject({ complete: true, passed: true, capturedVars: null });
  });

  it('reports the keys of a rejected capture body (never the values)', () => {
    const report = load('step-passed');
    report[0].results[2].request.data = '{"a":{"b":1},"c":"secret"}';
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result.capturedVars).toBeNull();
    expect(result.capturedVarsRejectedKeys).toEqual(['a', 'c']);
  });

  it('rejects the whole capture when a captured value contains the token (keys only reported)', () => {
    const report = load('step-passed');
    report[0].results[2].request.data = JSON.stringify({ a: 'fine', b: `Bearer ${TOKEN}`, c: 1 });
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result).toMatchObject({ complete: true, passed: true, capturedVars: null });
    expect(result.capturedVarsRejectedKeys).toEqual(['a', 'b', 'c']);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('rejects the whole capture when a captured key contains the token, and never lists that key', () => {
    const report = load('step-passed');
    report[0].results[2].request.data = JSON.stringify({ a: 'fine', [`k-${TOKEN}`]: 1 });
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result).toMatchObject({ complete: true, passed: true, capturedVars: null });
    expect(result.capturedVarsRejectedKeys).toEqual(['a', '[REDACTED]']);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it('caps the rejected key list', () => {
    const report = load('step-passed');
    const body: Record<string, unknown> = { nested: {} };
    for (let i = 0; i < 80; i++) body[`k${i}`] = i;
    report[0].results[2].request.data = JSON.stringify(body);
    const result = parseBrunoReport(report, { stepPath: STEP_01, token: TOKEN });
    expect(result.capturedVarsRejectedKeys).toHaveLength(50);
  });

  it('redacts the token from error messages', () => {
    const report = load('script-error');
    report[0].results[1].error = `Request failed with Bearer ${TOKEN}`;
    const [error] = parseBrunoReport(report, { stepPath: STEP_03, token: TOKEN }).errors;
    expect(error.error).toBe('Request failed with Bearer [REDACTED]');
  });
});

describe('cleanMessage', () => {
  it('strips ANSI colour codes', () => {
    const esc = String.fromCharCode(27);
    expect(cleanMessage(`${esc}[31mred${esc}[39m`, '')).toBe('red');
  });

  it('caps long messages', () => {
    expect(cleanMessage('x'.repeat(2000), '')).toHaveLength(1000);
  });

  it('has a vendor-readable incomplete-run message', () => {
    expect(incompleteRunReport().errors[0].error).toBe(INCOMPLETE_RUN_MESSAGE);
  });
});
