import {
  CERT_RUN_EVENTS_DEFAULT_LIMIT,
  CertificationRunEventDto,
  CertificationRunEventPageDto,
} from '@edanalytics/models';
import { useInfiniteQuery } from '@tanstack/react-query';
import { methods } from '../../api';
import { certificationQueryKeys } from './useCertificationCatalog';

const NO_EVENTS: CertificationRunEventDto[] = [];

/**
 * Paging is by offset and newest first, so an entry written after a page loaded shifts the next
 * page by one and repeats its first row. Keep the first copy of each entry.
 */
const uniqueById = (events: CertificationRunEventDto[]) => {
  const seen = new Set<number>();
  return events.filter((entry) => !seen.has(entry.eventId) && !!seen.add(entry.eventId));
};

/** The run's audit history (AC-650), newest first, a page at a time. */
export const useCertificationRunEvents = (teamId: number, runId: number | undefined) => {
  const query = useInfiniteQuery({
    queryKey: certificationQueryKeys.runEvents(teamId, runId),
    queryFn: ({ pageParam }) =>
      methods.getOne(
        `teams/${teamId}/certification/runs/${runId}/events`,
        CertificationRunEventPageDto,
        { offset: pageParam, limit: CERT_RUN_EVENTS_DEFAULT_LIMIT },
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: runId !== undefined,
    refetchOnMount: 'always',
  });

  return {
    events: query.data ? uniqueById(query.data.pages.flatMap((page) => page.items)) : NO_EVENTS,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
