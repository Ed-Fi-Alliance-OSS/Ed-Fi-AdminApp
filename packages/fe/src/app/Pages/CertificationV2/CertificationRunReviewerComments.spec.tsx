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

const comment = (
  commentId: number,
  decision: CertReviewDecision,
  reviewerName: string,
  text: string,
): CertificationRunCommentDto => ({
  commentId,
  createdAt: '2026-11-20T15:30:00.000Z',
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
    expect(screen.queryByText('Reviewer comments')).toBeNull();
  });

  it("shows each comment's date, reviewer, decision and text", () => {
    renderCard([
      comment(3, CERT_REVIEW_DECISION.APPROVED, 'Ann Reviewer', 'Looks good'),
      comment(2, CERT_REVIEW_DECISION.REJECTED, 'Bob Reviewer', 'Not compliant'),
      comment(1, CERT_REVIEW_DECISION.CHANGES_REQUESTED, 'Cy Reviewer', 'Please fix step 2'),
    ]);

    expect(screen.getByRole('heading', { name: 'Reviewer comments' })).toBeTruthy();
    for (const text of [
      'Approved',
      'Rejected',
      'Changes requested',
      'Ann Reviewer',
      'Bob Reviewer',
      'Cy Reviewer',
      'Looks good',
      'Not compliant',
      'Please fix step 2',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByText(new Date('2026-11-20T15:30:00.000Z').toLocaleString())).toHaveLength(
      3,
    );
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
