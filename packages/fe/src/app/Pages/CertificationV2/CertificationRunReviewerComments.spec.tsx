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

  it('keeps the decision badge in front of each sentence', () => {
    renderCard([
      comment(3, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good'),
      comment(2, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Not compliant'),
      comment(1, CERT_REVIEW_DECISION.CHANGES_REQUESTED, 'Cy Reviewer', 'Please fix step 2'),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent?.startsWith('Approved')).toBe(true);
    expect(items[1].textContent?.startsWith('Rejected')).toBe(true);
    expect(items[2].textContent?.startsWith('Changes requested')).toBe(true);
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

  it('keeps line breaks in a comment', () => {
    renderCard([comment(1, CERT_REVIEW_DECISION.REJECTED, 'Bob', 'Line one\nLine two')]);

    expect(getComputedStyle(screen.getByText(/Line one/)).whiteSpace).toBe('pre-wrap');
  });
});
