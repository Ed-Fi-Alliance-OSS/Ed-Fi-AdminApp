import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import omit from 'lodash/omit';
import { useParams } from 'react-router-dom';
import { sbeQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditSbe } from './EditSbe';
import { EditSbeMeta } from './EditSbeMeta';
import { RegisterSbeAdminApi } from './RegisterSbeAdminApi';
import { ViewSbeGlobal } from './ViewSbeGlobal';
import { useSbeGlobalActions } from './useSbeGlobalActions';

export const SbeGlobalPage = () => {
  const params = useParams() as { sbeId: string };
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
  }).data;
  const { edit } = useSearchParamsObject() as {
    edit?: 'admin-api' | 'sbe-meta' | 'name';
  };

  const actions = useSbeGlobalActions(sbe);

  return (
    <PageTemplate
      title={sbe?.displayName || 'Sbe'}
      actions={<PageActions actions={omit(actions, 'View')} />}
    >
      {sbe ? (
        edit === 'admin-api' ? (
          <RegisterSbeAdminApi sbe={sbe} />
        ) : edit === 'sbe-meta' ? (
          <EditSbeMeta sbe={sbe} />
        ) : edit === 'name' ? (
          <EditSbe sbe={sbe} />
        ) : (
          <ViewSbeGlobal sbe={sbe} />
        )
      ) : null}
    </PageTemplate>
  );
};
