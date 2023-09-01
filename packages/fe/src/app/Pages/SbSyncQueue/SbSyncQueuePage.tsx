import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { sbSyncQueueQueries } from '../../api';
import { ViewSbSyncQueue } from './ViewSbSyncQueue';
import { useSbSyncQueueActions } from './useSbSyncQueueActions';

export const SbSyncQueuePage = () => {
  const params = useParams() as { sbSyncQueueId: string };
  const sbSyncQueue = sbSyncQueueQueries.useOne({
    id: params.sbSyncQueueId,
  }).data;
  const actions = useSbSyncQueueActions(sbSyncQueue);
  return (
    <PageTemplate
      title={sbSyncQueue?.displayName || 'SbSyncQueue'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
    >
      {sbSyncQueue ? <ViewSbSyncQueue /> : null}
    </PageTemplate>
  );
};
