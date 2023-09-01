import { SbaaTableAllInOne, PageTemplate, ValueAsDate } from '@edanalytics/common-ui';
import { GetEdorgDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { useParams } from 'react-router-dom';
import { edorgQueries, odsQueries } from '../../api';
import { queryClient } from '../../app';
import { AuthorizeConfig, arrayElemIf, authorize } from '../../helpers';
import { getRelationDisplayName } from '../../helpers/getRelationDisplayName';
import { EdorgLink, OdsLink } from '../../routes';
import { NameCell } from './NameCell';

export const EdorgsPage = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
  };
  const odsAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.ods:read',
    subject: {
      id: '__filtered__',
      sbeId: Number(params.sbeId),
      tenantId: Number(params.asId),
    },
  };
  const odss = odsQueries.useAll({ tenantId: params.asId, sbeId: params.sbeId, optional: true });
  const edorgs = edorgQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });

  return (
    <PageTemplate title="Education Organizations">
      <SbaaTableAllInOne
        data={Object.values(edorgs?.data || {})}
        columns={[
          {
            accessorKey: 'displayName',
            cell: NameCell,
            header: 'Name',
          },
          {
            id: 'shortName',
            accessorFn: (info) => info.shortNameOfInstitution,
            header: 'Short name',
          },
          {
            id: 'parent',
            accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
            header: 'Parent Ed-Org',
            cell: (info) => <EdorgLink query={edorgs} id={info.row.original.parentId} />,
            meta: {
              type: 'options',
            },
          },
          {
            id: 'educationOrganizationId',
            accessorFn: (info) => String(info.educationOrganizationId),
            header: 'Education Org ID',
            meta: { type: 'options' },
          },
          ...arrayElemIf(authorize({ config: odsAuth, queryClient }), {
            id: 'ods',
            accessorFn: (info: GetEdorgDto) => getRelationDisplayName(info.odsId, odss),
            header: 'ODS',
            cell: (info: CellContext<GetEdorgDto, unknown>) => (
              <OdsLink query={odss} id={info.row.original.odsId} />
            ),
            meta: {
              type: 'options',
            },
          }),
          {
            id: 'discriminator',
            accessorFn: (info) => info.discriminator,
            header: 'Type',
            meta: {
              type: 'options',
            },
          },
          {
            accessorKey: 'createdNumber',
            cell: ValueAsDate(),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
        ]}
      />
    </PageTemplate>
  );
};
