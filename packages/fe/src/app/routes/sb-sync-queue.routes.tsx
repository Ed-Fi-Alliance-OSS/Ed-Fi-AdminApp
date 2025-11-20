import { Link, Text } from '@chakra-ui/react';
import { GetEdfiTenantDto, SbSyncQueueDto } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import { SbSyncQueuePage } from '../Pages/SbSyncQueue/SbSyncQueuePage';
import { SbSyncQueuesPage } from '../Pages/SbSyncQueue/SbSyncQueuesPage';
import { sbSyncQueueQueries } from '../api';
import { getRelationDisplayName, useEdfiTenantNavContext } from '../helpers';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const SbSyncQueueBreadcrumb = () => {
  const params = useParams() as { sbSyncQueueId: string };
  const sbSyncQueue = useQuery(
    sbSyncQueueQueries.getOne({
      id: params.sbSyncQueueId,
    })
  );
  return sbSyncQueue.data?.displayName ?? params.sbSyncQueueId;
};

export const sbSyncQueueIndexRoute: RouteObject = {
  path: '/sb-sync-queues/:sbSyncQueueId/',
  element: <SbSyncQueuePage />,
};
export const sbSyncQueueRoute: RouteObject = {
  path: '/sb-sync-queues/:sbSyncQueueId',
  handle: { crumb: SbSyncQueueBreadcrumb },
};
export const sbSyncQueuesIndexRoute: RouteObject = {
  path: '/sb-sync-queues/',
  element: <SbSyncQueuesPage />,
};
export const sbSyncQueuesRoute: RouteObject = {
  path: '/sb-sync-queues',
  handle: { crumb: () => 'SB sync queue' },
};

export const SbSyncQueueLink = (props: {
  id: string | undefined;
  query: Pick<UseQueryResult<Record<string | number, SbSyncQueueDto>, unknown>, 'data'>;
}) => {
  const sbSyncQueue = getEntityFromQuery(props.id, props.query);
  return sbSyncQueue ? (
    <Link as="span">
      <RouterLink title="Go to sync queue item" to={`/sb-sync-queues/${sbSyncQueue.id}`}>
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : typeof props.id === 'string' ? (
    <Text
      title="Sync queue item may have been deleted, or you lack access."
      as="i"
      color="gray.500"
    >
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
