import 'reflect-metadata';
import {
  CERT_RUN_EVENT,
  CERT_RUN_EVENT_LABELS,
  CERT_RUN_STATUS,
  CERT_RUN_TRANSITIONS,
  CertRunStatus,
  CertificationRunEventDto,
  certRunEventFor,
  toCertificationRunEventPageDto,
} from '../index';

describe('certRunEventFor', () => {
  it('maps every allowed transition to an event', () => {
    for (const [from, targets] of Object.entries(CERT_RUN_TRANSITIONS)) {
      for (const to of targets) {
        expect(() => certRunEventFor(from as CertRunStatus, to)).not.toThrow();
      }
    }
  });

  it('maps the vendor and reviewer transitions', () => {
    const S = CERT_RUN_STATUS;
    expect(certRunEventFor(S.DRAFT, S.READY_FOR_REVIEW)).toBe(CERT_RUN_EVENT.SUBMITTED);
    expect(certRunEventFor(S.CHANGES_REQUESTED, S.READY_FOR_REVIEW_WITH_CHANGES)).toBe(
      CERT_RUN_EVENT.RESUBMITTED,
    );
    expect(certRunEventFor(S.READY_FOR_REVIEW, S.IN_REVIEW)).toBe(CERT_RUN_EVENT.PICKED_UP);
    expect(certRunEventFor(S.READY_FOR_REVIEW_WITH_CHANGES, S.IN_REVIEW)).toBe(
      CERT_RUN_EVENT.PICKED_UP,
    );
    expect(certRunEventFor(S.IN_REVIEW, S.CHANGES_REQUESTED)).toBe(
      CERT_RUN_EVENT.CHANGES_REQUESTED,
    );
    expect(certRunEventFor(S.IN_REVIEW, S.APPROVED)).toBe(CERT_RUN_EVENT.APPROVED);
    expect(certRunEventFor(S.IN_REVIEW, S.REJECTED)).toBe(CERT_RUN_EVENT.REJECTED);
  });

  it("throws for a transition that isn't allowed", () => {
    expect(() => certRunEventFor(CERT_RUN_STATUS.DRAFT, CERT_RUN_STATUS.APPROVED)).toThrow();
  });
});

describe('CERT_RUN_EVENT_LABELS', () => {
  it('labels every event', () => {
    expect(Object.values(CERT_RUN_EVENT).every((e) => CERT_RUN_EVENT_LABELS[e])).toBe(true);
    expect(CERT_RUN_EVENT_LABELS[CERT_RUN_EVENT.CREATED]).toBe('Run started');
  });
});

describe('toCertificationRunEventPageDto', () => {
  it('serializes a page with nested items', () => {
    const page = toCertificationRunEventPageDto({
      items: [
        {
          eventId: 1,
          event: CERT_RUN_EVENT.CREATED,
          fromStatus: null,
          toStatus: CERT_RUN_STATUS.DRAFT,
          createdAt: '2026-01-01T00:00:00.000Z',
          actorName: 'Ana',
          comment: null,
        },
      ],
      total: 1,
    });
    expect(page.items[0]).toBeInstanceOf(CertificationRunEventDto);
    expect(page.items[0].comment).toBeNull();
    expect(page.total).toBe(1);
  });
});
