import 'reflect-metadata';
import { ChakraProvider } from '@chakra-ui/react';
import {
  CERT_REVIEW_DECISION,
  CertificationRunCommentDto,
  CertReviewDecision,
} from '@edanalytics/models';
import { render, screen } from '@testing-library/react';
import { CertificationRunReviewerComments } from './CertificationRunReviewerComments';
import { useCertificationRunComments } from './useCertificationRunComments';

jest.mock('../../api', () => ({ methods: {} }));
jest.mock('./useCertificationRunComments', () => ({ useCertificationRunComments: jest.fn() }));

const CREATED_AT = '2026-11-20T15:30:00.000Z';
const DATE = new Date(CREATED_AT).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const comment = (
  commentId: number,
  decision: CertReviewDecision,
  reviewerName: string,
  text: string,
): CertificationRunCommentDto => ({
  commentId,
  createdAt: CREATED_AT,
  reviewerName,
  decision,
  text,
});

const renderCard = (comments: CertificationRunCommentDto[]) => {
  (useCertificationRunComments as jest.Mock).mockReturnValue({ comments });
  return render(
    <ChakraProvider>
      <CertificationRunReviewerComments teamId={2} runId={7} />
    </ChakraProvider>,
  );
};

describe('CertificationRunReviewerComments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when the run has no comments', () => {
    renderCard([]);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('has no visible heading, but names the list for screen readers', () => {
    renderCard([comment(1, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good')]);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('list', { name: 'Reviewer comments' })).toBeTruthy();
  });

  it('writes each decision as a sentence with the reviewer, the date and the comment', () => {
    renderCard([
      comment(3, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good'),
      comment(2, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Not compliant'),
      comment(1, CERT_REVIEW_DECISION.CHANGES_REQUESTED, 'Cy Reviewer', 'Please fix step 2'),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain(
      `Ann Reviewer approved this run on ${DATE} with the following comments:`,
    );
    expect(items[1].textContent).toContain(
      `Bob Reviewer rejected this run on ${DATE} for the following reason:`,
    );
    expect(items[2].textContent).toContain(
      `Cy Reviewer requested changes to this run on ${DATE} with the following comments:`,
    );
    for (const text of ['Looks good', 'Not compliant', 'Please fix step 2']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('starts each sentence with the reviewer, with no decision badge', () => {
    renderCard([
      comment(3, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good'),
      comment(2, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Not compliant'),
      comment(1, CERT_REVIEW_DECISION.CHANGES_REQUESTED, 'Cy Reviewer', 'Please fix step 2'),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent?.startsWith('Ann Reviewer')).toBe(true);
    expect(items[1].textContent?.startsWith('Bob Reviewer')).toBe(true);
    expect(items[2].textContent?.startsWith('Cy Reviewer')).toBe(true);
  });

  it('marks the date up as a machine-readable time', () => {
    renderCard([comment(1, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Not compliant')]);

    expect(screen.getByText(DATE).getAttribute('datetime')).toBe(CREATED_AT);
  });

  it('keeps the API order across review rounds', () => {
    renderCard([
      comment(2, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Second round'),
      comment(1, CERT_REVIEW_DECISION.CHANGES_REQUESTED, 'Ann Reviewer', 'First round'),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Second round');
    expect(items[1].textContent).toContain('First round');
  });

  it('falls back to a generic sentence for a decision it does not know', () => {
    renderCard([
      comment(1, 'ESCALATED' as CertReviewDecision, 'Dee Reviewer', 'Sent to the board'),
    ]);

    expect(screen.getByRole('listitem').textContent).toContain(
      `Dee Reviewer reviewed this run on ${DATE} with the following comments:`,
    );
    expect(screen.getByText('Sent to the board')).toBeTruthy();
  });

  it('leaves space below the list, like the review bar above it', () => {
    renderCard([comment(1, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good')]);

    // jsdom lets Chakra's `:where(ol, ul) { margin: 0 }` reset beat the class rule, which a
    // browser wouldn't, so read the list's own style rule instead of its computed style.
    const classes = screen.getByRole('list').className.split(' ');
    const ownRules = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && classes.some((c) => rule.selectorText === `.${c}`),
      );
    expect(ownRules.map((rule) => rule.cssText).join(' ')).toContain(
      'margin-bottom: var(--chakra-space-4)',
    );
  });

  it('keeps line breaks in a comment', () => {
    renderCard([comment(1, CERT_REVIEW_DECISION.REJECTED, 'Bob', 'Line one\nLine two')]);

    expect(getComputedStyle(screen.getByText(/Line one/)).whiteSpace).toBe('pre-wrap');
  });
});
