import 'reflect-metadata';
import { CERT_RUN_STATUS } from '@edanalytics/models';
import { CERT_RUN_STATUS_COLOR_SCHEMES, certRunStatusColor } from './certificationRunStatusColor';

describe('certRunStatusColor', () => {
  it('maps each status to its Chakra color scheme', () => {
    expect(certRunStatusColor(CERT_RUN_STATUS.DRAFT)).toBe('gray');
    expect(certRunStatusColor(CERT_RUN_STATUS.READY_FOR_REVIEW)).toBe('blue');
    expect(certRunStatusColor(CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES)).toBe('cyan');
    expect(certRunStatusColor(CERT_RUN_STATUS.IN_REVIEW)).toBe('purple');
    expect(certRunStatusColor(CERT_RUN_STATUS.CHANGES_REQUESTED)).toBe('orange');
    expect(certRunStatusColor(CERT_RUN_STATUS.APPROVED)).toBe('green');
    expect(certRunStatusColor(CERT_RUN_STATUS.REJECTED)).toBe('red');
  });

  it('covers every CERT_RUN_STATUS value', () => {
    for (const status of Object.values(CERT_RUN_STATUS)) {
      expect(CERT_RUN_STATUS_COLOR_SCHEMES[status]).toEqual(expect.any(String));
      expect(CERT_RUN_STATUS_COLOR_SCHEMES[status]).not.toBe('');
    }
  });
});
