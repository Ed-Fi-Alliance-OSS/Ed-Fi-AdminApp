import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  isSupportedSisVersion,
  PostCertificationStepRunDto,
  SUPPORTED_SIS_VERSIONS,
  toCertificationStepRunDto,
} from './certification-step-run.dto';

// Same transform options as the API's global ValidationPipe.
const toDto = (plain: object) =>
  plainToInstance(PostCertificationStepRunDto, plain, {
    excludeExtraneousValues: true,
    exposeUnsetFields: false,
  });

const invalidProperties = (plain: object) => validateSync(toDto(plain)).map((e) => e.property);

describe('certification step run DTOs', () => {
  it('supports only SIS v5 for now', () => {
    expect(SUPPORTED_SIS_VERSIONS).toEqual(['v5']);
    expect(isSupportedSisVersion('v5')).toBe(true);
    expect(isSupportedSisVersion('v4')).toBe(false);
  });

  it('accepts a valid body, keeps the inputs object and drops unknown keys', () => {
    const dto = toDto({
      odsId: '5',
      token: 'abc.DEF-123_~',
      inputs: { studentUniqueId: '604822' },
      extra: 'dropped',
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto).toEqual({ odsId: 5, token: 'abc.DEF-123_~', inputs: { studentUniqueId: '604822' } });
  });

  it.each(['', 'has space', 'line\nbreak', 'x'.repeat(4097)])('rejects token %j', (token) => {
    expect(invalidProperties({ token, inputs: {} })).toContain('token');
  });

  it('requires inputs to be an object', () => {
    expect(invalidProperties({ token: 't', inputs: 'nope' })).toContain('inputs');
  });

  it('serializes a run result with its errors', () => {
    const result = toCertificationStepRunDto({
      stepId: 3,
      status: 'failed',
      ranAt: '2026-10-12T20:00:00.000Z',
      scenarioStatus: 'failed',
      errors: [{ property: 'birthDate changed', validation: 'test', error: 'expected a change' }],
    });
    expect(result).toEqual({
      stepId: 3,
      status: 'failed',
      ranAt: '2026-10-12T20:00:00.000Z',
      scenarioStatus: 'failed',
      errors: [{ property: 'birthDate changed', validation: 'test', error: 'expected a change' }],
    });
  });
});
