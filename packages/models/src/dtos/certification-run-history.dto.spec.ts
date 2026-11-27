import 'reflect-metadata';
import { CERT_MODEL, CERT_RUN_STATUS } from './certification-run.dto';
import { toCertificationRunHistoryDto } from './certification-run-history.dto';

describe('toCertificationRunHistoryDto', () => {
  it('exposes every field of a row and drops anything else', () => {
    const row = {
      runId: 42,
      edfiTenantId: 3,
      odsId: 8,
      environmentName: 'Vendor B',
      tenantName: 'Tenant 1',
      dataStoreName: 'Test SIS App',
      certificationModel: CERT_MODEL.sis,
      status: CERT_RUN_STATUS.DRAFT,
      createdAt: '2026-09-07T13:00:00.000Z',
      completedScenarios: 12,
      totalScenarios: 30,
    };

    const result = toCertificationRunHistoryDto([{ ...row, secret: 'x' }] as never);

    expect(result).toEqual([row]);
  });
});
