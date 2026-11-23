import { List, ListItem, Text } from '@chakra-ui/react';
import { CertReviewDecision } from '@edanalytics/models';
import { useCertificationRunComments } from './useCertificationRunComments';

/** How each decision reads after the reviewer's name, and what introduces the comment. */
const DECISION_SENTENCE: Record<CertReviewDecision, { verb: string; lead: string }> = {
  APPROVED: { verb: 'approved this run', lead: 'with the following comments:' },
  REJECTED: { verb: 'rejected this run', lead: 'for the following reason:' },
  CHANGES_REQUESTED: {
    verb: 'requested changes to this run',
    lead: 'with the following comments:',
  },
};

/** Used for a decision this page doesn't know yet, so one odd row can't break the Scenarios page. */
const FALLBACK_SENTENCE = { verb: 'reviewed this run', lead: 'with the following comments:' };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * What reviewers wrote on the run, newest first, so a team can see why changes were requested
 * or the run was rejected (AC-662). Each decision reads as a sentence, for example "Ann Ruiz
 * requested changes to this run on Nov 20, 2026, 3:30 PM with the following comments:".
 * The run's status badge sits in the review bar above, so no decision badge here.
 * Hidden when there are no comments.
 */
export const CertificationRunReviewerComments = ({
  teamId,
  runId,
}: {
  teamId: number;
  runId: number;
}) => {
  const { comments } = useCertificationRunComments(teamId, runId);
  if (comments.length === 0) return null;

  return (
    <List spacing={3} mb={4} aria-label="Reviewer comments">
      {comments.map((comment) => {
        const { verb, lead } = DECISION_SENTENCE[comment.decision] ?? FALLBACK_SENTENCE;
        return (
          <ListItem key={comment.commentId}>
            <Text mb={1}>
              <Text as="span" fontWeight="semibold">
                {comment.reviewerName}
              </Text>{' '}
              {verb} on{' '}
              <Text as="time" dateTime={comment.createdAt}>
                {formatDate(comment.createdAt)}
              </Text>{' '}
              {lead}
            </Text>
            <Text whiteSpace="pre-wrap">{comment.text}</Text>
          </ListItem>
        );
      })}
    </List>
  );
};
