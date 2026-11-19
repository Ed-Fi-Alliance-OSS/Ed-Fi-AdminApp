import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CERT_RUN_STATUS } from './certification-run.dto';
import type { CertRunStatus } from './certification-run.dto';
import {
  CERT_REVIEW_DECISION,
  CERT_REVIEW_READABLE_STATUSES,
  PostCertificationReviewDecisionDto,
  isReviewReadable,
  reviewDecisionNeedsComment,
  toCertificationReviewDto,
  toCertificationReviewStatusDto,
} from './certification-review.dto';

describe('reviewDecisionNeedsComment', () => {
  it.each([
    [CERT_REVIEW_DECISION.APPROVED, false],
    [CERT_REVIEW_DECISION.REJECTED, true],
    [CERT_REVIEW_DECISION.CHANGES_REQUESTED, true],
  ])('%s -> %s', (decision, expected) => {
    expect(reviewDecisionNeedsComment(decision)).toBe(expected);
  });
});

describe('isReviewReadable', () => {
  it.each([
    CERT_RUN_STATUS.READY_FOR_REVIEW,
    CERT_RUN_STATUS.READY_FOR_REVIEW_WITH_CHANGES,
    CERT_RUN_STATUS.IN_REVIEW,
    CERT_RUN_STATUS.APPROVED,
    CERT_RUN_STATUS.REJECTED,
  ] as CertRunStatus[])('%s is readable', (status) => {
    expect(isReviewReadable(status)).toBe(true);
    expect(CERT_REVIEW_READABLE_STATUSES).toContain(status);
  });

  it.each([CERT_RUN_STATUS.DRAFT, CERT_RUN_STATUS.CHANGES_REQUESTED] as CertRunStatus[])(
    '%s is not readable',
    (status) => {
      expect(isReviewReadable(status)).toBe(false);
    },
  );
});

describe('PostCertificationReviewDecisionDto', () => {
  const parse = (plain: object) => plainToInstance(PostCertificationReviewDecisionDto, plain);

  it('trims the comment', async () => {
    const dto = parse({ comment: '  ok  ' });
    expect(dto.comment).toBe('ok');
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a comment over 4000 characters', async () => {
    const errors = await validate(parse({ comment: 'x'.repeat(4001) }));
    expect(errors).toHaveLength(1);
    expect(Object.keys(errors[0].constraints ?? {})).toEqual(['maxLength']);
  });

  it('accepts no comment', async () => {
    expect(await validate(parse({}))).toEqual([]);
  });
});

describe('toCertificationReviewDto', () => {
  it('keeps the nested step result errors', () => {
    const dto = toCertificationReviewDto({
      run: {
        runId: 1,
        teamName: null,
        environmentName: 'env',
        tenantName: 'tenant',
        dataStoreName: null,
        certificationModel: 'SIS',
        status: 'IN_REVIEW',
        submittedAt: null,
        dataStandardVersion: 'v5',
        canDecide: true,
      },
      scenarios: [
        {
          scenarioId: 10,
          domainName: 'Domain',
          name: 'Scenario',
          status: 'completed',
          steps: [
            {
              stepId: 100,
              name: 'Step',
              result: {
                stepId: 100,
                status: 'failed',
                ranAt: '2026-11-18T10:00:00.000Z',
                inputs: null,
                responseStatus: 400,
                errors: [{ message: 'boom' }],
              },
            },
          ],
        },
      ],
    } as never);
    expect(dto.scenarios[0].steps[0].result?.errors).toEqual([{ message: 'boom' }]);
    expect(dto.run.canDecide).toBe(true);
  });

  it('serializes the status response', () => {
    expect(toCertificationReviewStatusDto({ runId: 1, status: 'APPROVED' })).toEqual({
      runId: 1,
      status: 'APPROVED',
    });
  });
});
