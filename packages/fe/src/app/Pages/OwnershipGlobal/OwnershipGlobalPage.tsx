import { ActionBarActions, PageTemplate } from '@edanalytics/common-ui';
import _ from 'lodash';
import { useParams } from 'react-router-dom';
import { ownershipQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditOwnershipGlobal } from './EditOwnershipGlobal';
import { ViewOwnershipGlobal } from './ViewOwnershipGlobal';
import { useOwnershipGlobalActions } from './useOwnershipGlobalActions';

export const OwnershipGlobalPage = () => {
  const params = useParams() as {
    ownershipId: string;
  };
  const ownership = ownershipQueries.useOne({
    id: params.ownershipId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };
  const actions = useOwnershipGlobalActions(ownership);

  return (
    <PageTemplate
      constrainWidth
      title={ownership?.displayName || 'Ownership'}
      actions={<ActionBarActions actions={_.omit(actions, 'View')} />}
    >
      {ownership ? (
        edit ? (
          <EditOwnershipGlobal ownership={ownership} />
        ) : (
          <ViewOwnershipGlobal />
        )
      ) : null}
    </PageTemplate>
  );
};
