import { SbaaTableAllInOne, PageTemplate } from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { odsQueries } from '../../api/queries/queries';
import { NameCell } from './NameCell';

export const OdssPage = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
  };
  const odss = odsQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });

  return (
    <PageTemplate title="Operational Data Stores">
      <SbaaTableAllInOne
        data={Object.values(odss?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: 'Name',
          },
          {
            accessorKey: 'createdDetailed',
            header: 'Created',
            meta: { type: 'date' },
          },
          {
            accessorKey: 'modifiedDetailed',
            header: 'Modified',
            meta: { type: 'date' },
          },
        ]}
      />
    </PageTemplate>
  );
};
