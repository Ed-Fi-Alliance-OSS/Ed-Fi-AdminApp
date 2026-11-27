import { CertificationRunCommentDto } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';

const NO_COMMENTS: CertificationRunCommentDto[] = [];

export const useCertificationRunComments = (teamId: number, runId: number | undefined) => {
  const commentsQuery = useQuery({
    queryKey: certificationQueryKeys.runComments(teamId, runId),
    queryFn: () =>
      methods.getMany(
        `teams/${teamId}/certification/runs/${runId}/comments`,
        CertificationRunCommentDto,
      ),
    enabled: runId !== undefined,
    refetchOnMount: 'always',
  });
  return { comments: commentsQuery.data ?? NO_COMMENTS };
};
