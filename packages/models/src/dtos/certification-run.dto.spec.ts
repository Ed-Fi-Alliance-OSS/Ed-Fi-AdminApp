import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CERT_RUN_STATUS,
  CertRunStatus,
  PostCertificationRunDto,
  SUPPORTED_CERT_MODELS,
  canExecuteSteps,
  canTransitionRun,
  certRunAlreadyOpenMessage,
  isOpenRunStatus,
  sendToReviewStatus,
  toCertificationLatestRunDto,
  toCertificationRunDto,
} from './certification-run.dto';

const ALL = Object.values(CERT_RUN_STATUS);

describe('certification run statuses', () => {
  it('has the seven statuses', () => {
    expect(CERT_RUN_STATUS).toEqual({
      DRAFT: 'DRAFT',
      READY_FOR_REVIEW: 'READY_FOR_REVIEW',
      IN_REVIEW: 'IN_REVIEW',
      CHANGES_REQUESTED: 'CHANGES_REQUESTED',
      READY_FOR_REVIEW_WITH_CHANGES: 'READY_FOR_REVIEW_WITH_CHANGES',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
    });
  });

  it.each(ALL)('canExecuteSteps(%s) is true only for Draft and Changes requested', (status) => {
    expect(canExecuteSteps(status)).toBe(status === 'DRAFT' || status === 'CHANGES_REQUESTED');
  });

  it.each(ALL)('isOpenRunStatus(%s) is false only for Approved and Rejected', (status) => {
    expect(isOpenRunStatus(status)).toBe(status !== 'APPROVED' && status !== 'REJECTED');
  });

  it('allows exactly the seven listed status changes', () => {
    const allowed = ALL.flatMap((from) =>
      ALL.filter((to) => canTransitionRun(from, to)).map((to) => `${from}>${to}`),
    );
    expect(allowed.sort()).toEqual(
      [
        'DRAFT>READY_FOR_REVIEW',
        'CHANGES_REQUESTED>READY_FOR_REVIEW_WITH_CHANGES',
        'READY_FOR_REVIEW>IN_REVIEW',
        'READY_FOR_REVIEW_WITH_CHANGES>IN_REVIEW',
        'IN_REVIEW>CHANGES_REQUESTED',
        'IN_REVIEW>APPROVED',
        'IN_REVIEW>REJECTED',
      ].sort(),
    );
  });

  it('refuses Draft straight to Approved', () => {
    expect(canTransitionRun('DRAFT', 'APPROVED')).toBe(false);
  });

  it('sends a Draft run to Ready for review', () => {
    expect(sendToReviewStatus('DRAFT')).toBe('READY_FOR_REVIEW');
  });

  it('sends a Changes requested run to Ready for review with new changes', () => {
    expect(sendToReviewStatus('CHANGES_REQUESTED')).toBe('READY_FOR_REVIEW_WITH_CHANGES');
  });

  it.each<CertRunStatus>([
    'READY_FOR_REVIEW',
    'IN_REVIEW',
    'READY_FOR_REVIEW_WITH_CHANGES',
    'APPROVED',
    'REJECTED',
  ])('cannot send a %s run to review', (status) => {
    expect(sendToReviewStatus(status)).toBeNull();
  });
});

describe('PostCertificationRunDto', () => {
  const build = (plain: object): PostCertificationRunDto =>
    plainToInstance(PostCertificationRunDto, plain, { excludeExtraneousValues: true });

  it('accepts a data store and a Certification Model', async () => {
    expect(await validate(build({ odsId: 3, certificationModel: 'SIS' }))).toHaveLength(0);
  });

  it('rejects a missing data store', async () => {
    const errors = await validate(build({ certificationModel: 'SIS' }));
    expect(errors.map((e) => e.property)).toEqual(['odsId']);
  });

  it('rejects an unknown Certification Model', async () => {
    const errors = await validate(build({ odsId: 3, certificationModel: 'XYZ' }));
    expect(errors.map((e) => e.property)).toEqual(['certificationModel']);
  });

  it('drops fields the browser must not choose', () => {
    expect(build({ odsId: 3, certificationModel: 'SIS', teamId: 9 })).not.toHaveProperty('teamId');
  });
});

describe('run serializers', () => {
  it('says which model already has an open run', () => {
    expect(certRunAlreadyOpenMessage('SIS')).toBe('A SIS run is already open for this data store.');
  });

  it('lists only SIS as a supported Certification Model', () => {
    expect(SUPPORTED_CERT_MODELS).toEqual(['SIS']);
  });

  it('keeps only the exposed run fields', () => {
    const run = {
      runId: 7,
      sbEnvironmentId: 1,
      edfiTenantId: 2,
      odsId: 3,
      environmentName: 'Env',
      tenantName: 'default',
      dataStoreName: 'ods-1',
      certificationModel: 'SIS',
      status: 'DRAFT',
      canExecuteSteps: true,
      dataStandardVersion: 'v5',
    };
    expect(toCertificationRunDto({ ...run, createdById: 4 } as never)).toEqual(run);
  });

  it('keeps only the exposed latest-run fields', () => {
    const latest = { certificationModel: 'SIS', runId: 7, status: 'REJECTED', isOpen: false };
    expect(toCertificationLatestRunDto({ ...latest, teamId: 1 } as never)).toEqual(latest);
  });
});
