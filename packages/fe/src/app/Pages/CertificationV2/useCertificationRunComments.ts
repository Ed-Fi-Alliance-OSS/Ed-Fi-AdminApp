import { CertificationRunCommentDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';

const NO_COMMENTS: CertificationRunCommentDto[] = [];

/**
 * A run's reviewer comments, newest first (AC-662). Unlike the run itself, a failed read must
 * not send the page to the error route: the card just stays hidden.
 */
export const useCertificationRunComments = (teamId: number, runId: number | undefined) => {
  const commentsQuery = useQuery({
    queryKey: certificationQueryKeys.runComments(teamId, runId),
    queryFn: () =>
      methods.getMany(
        `teams/${teamId}/certification/runs/${runId}/comments`,
        CertificationRunCommentDto,
      ),
    enabled: runId !== undefined,
  });
  return { comments: commentsQuery.data ?? NO_COMMENTS };
};
