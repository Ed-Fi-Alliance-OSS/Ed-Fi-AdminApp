import { Badge, Box, Heading, HStack, List, ListItem, Text } from '@chakra-ui/react';
import { CERT_REVIEW_DECISION_LABELS } from '@edanalytics/models';
import { CERT_RUN_STATUS_COLOR } from './certificationRunStatus';
import { useCertificationRunComments } from './useCertificationRunComments';

const DECISION_COLOR = {
  APPROVED: CERT_RUN_STATUS_COLOR.APPROVED,
  REJECTED: CERT_RUN_STATUS_COLOR.REJECTED,
  CHANGES_REQUESTED: CERT_RUN_STATUS_COLOR.CHANGES_REQUESTED,
} as const;

/**
 * What reviewers wrote on the run, newest first, so a team can see why changes were requested
 * or the run was rejected (AC-662). Hidden when there are no comments.
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
    <Box borderWidth="1px" borderRadius="md" p={4} mb={4}>
      <Heading as="h2" size="sm" mb={3}>
        Reviewer comments
      </Heading>
      <List spacing={3}>
        {comments.map((comment) => (
          <ListItem key={comment.commentId}>
            <HStack spacing={2} mb={1} wrap="wrap">
              <Badge colorScheme={DECISION_COLOR[comment.decision]}>
                {CERT_REVIEW_DECISION_LABELS[comment.decision]}
              </Badge>
              <Text fontWeight="semibold">{comment.reviewerName}</Text>
              <Text fontSize="sm" color="gray.600">
                {new Date(comment.createdAt).toLocaleString()}
              </Text>
            </HStack>
            <Text whiteSpace="pre-wrap">{comment.text}</Text>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
