import {
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  DataTable,
} from '@edanalytics/common-ui';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { edorgQueries, odsQueries, sbeQueries } from '../../api';
import { AuthorizeComponent, getRelationDisplayName } from '../../helpers';
import { EdorgLink, SbeLink } from '../../routes';
import { NameCell } from '../Edorg/NameCell';

export const ViewOds = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    odsId: string;
  };
  const ods = odsQueries.useOne({
    id: params.odsId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const sbes = sbeQueries.useAll({
    tenantId: params.asId,
  });
  const edorgs = edorgQueries.useAll({
    optional: true,
    tenantId: params.asId,
    sbeId: params.sbeId,
  });

  const filteredEdorgs = useMemo(
    () => Object.values(edorgs?.data || {}).filter((edorg) => edorg.odsId === Number(params.odsId)),
    [params, edorgs]
  );

  return ods ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <AttributeContainer label="Environment">
            <SbeLink id={ods.sbeId} query={sbes} />
          </AttributeContainer>
        </AttributesGrid>
      </ContentSection>
      <AuthorizeComponent
        config={{
          privilege: 'tenant.sbe.edorg:read',
          subject: {
            id: '__filtered__',
            sbeId: Number(params.sbeId),
            tenantId: Number(params.asId),
          },
        }}
      >
        <ContentSection heading="Ed-Orgs">
          <DataTable
            queryKeyPrefix={`edorg`}
            data={filteredEdorgs}
            columns={[
              {
                accessorKey: 'displayName',
                cell: NameCell,
                header: 'Name',
              },
              {
                id: 'parent',
                accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
                header: 'Parent Ed-Org',
                cell: (info) => <EdorgLink query={edorgs} id={info.row.original.parentId} />,
              },
              {
                id: 'discriminator',
                accessorFn: (info) => info.discriminator,
                header: 'Type',
              },
            ]}
          />
        </ContentSection>
      </AuthorizeComponent>
    </>
  ) : null;
};
