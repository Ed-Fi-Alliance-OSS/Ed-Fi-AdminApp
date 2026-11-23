import { Box, Heading, List, ListItem, Text } from '@chakra-ui/react';
import { CertReviewDecision } from '@edanalytics/models';
import { useId } from 'react';
import { useCertificationRunComments } from './useCertificationRunComments';

const DECISION_SENTENCE: Record<CertReviewDecision, { verb: string; lead: string }> = {
  APPROVED: { verb: 'approved this run', lead: 'with the following comments:' },
  REJECTED: { verb: 'rejected this run', lead: 'for the following reason:' },
  CHANGES_REQUESTED: {
    verb: 'requested changes to this run',
    lead: 'with the following comments:',
  },
};

const FALLBACK_SENTENCE = { verb: 'reviewed this run', lead: 'with the following comments:' };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const CertificationRunReviewerComments = ({
  teamId,
  runId,
}: {
  teamId: number;
  runId: number;
}) => {
  const headingId = useId();
  const { comments } = useCertificationRunComments(teamId, runId);
  if (comments.length === 0) return null;

  return (
    <Box mb={4}>
      <Heading as="h2" size="sm" id={headingId} mb={2}>
        Reviewer comments
      </Heading>
      <List spacing={3} aria-labelledby={headingId}>
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
    </Box>
  );
};
