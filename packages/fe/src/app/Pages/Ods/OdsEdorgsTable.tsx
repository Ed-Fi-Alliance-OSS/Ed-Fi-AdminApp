import { SbaaTableAllInOne } from '@edanalytics/common-ui';
import { EdorgSampleRow, sampleEdorgData } from './edorgData';

const getParentName = (parentId: number | null): string => {
  if (parentId === null) return '—';
  return sampleEdorgData.find((e) => e.id === parentId)?.nameOfInstitution ?? '—';
};

export const OdsEdorgsTable = () => {
  return (
    <SbaaTableAllInOne
      queryKeyPrefix="edorg"
      data={sampleEdorgData}
      columns={[
        {
          accessorKey: 'nameOfInstitution',
          header: 'Name',
        },
        {
          id: 'parent',
          accessorFn: (row: EdorgSampleRow) => getParentName(row.parentId),
          header: 'Parent Ed-Org',
        },
        {
          accessorKey: 'discriminator',
          header: 'Type',
        },
      ]}
    />
  );
};
