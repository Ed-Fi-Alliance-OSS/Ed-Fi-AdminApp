import {
  Attribute,
  AttributesGrid,
  ContentSection,
  SbaaTableAllInOne,
  ValueAsDate,
} from '@edanalytics/common-ui';
import { GetTenantDto } from '@edanalytics/models';
import { useParams } from 'react-router-dom';
import {
  ownershipQueries,
  roleQueries,
  tenantQueries,
  userQueries,
  userTenantMembershipQueries,
} from '../../api';
import { AuthorizeComponent, getRelationDisplayName } from '../../helpers';
import { UserGlobalLink } from '../../routes';
import { RoleGlobalLink } from '../../routes/role-global.routes';
import { OwnershipsNameCell } from '../OwnershipGlobal/OwnershipsNameCell';
import { UtmGlobalNameCell } from '../UserTenantMembershipGlobal/UtmGlobalNameCell';

export const ViewTenant = () => {
  const params = useParams() as { tenantId: string };
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;

  return tenant ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Name" value={tenant.name} />
        </AttributesGrid>
      </ContentSection>
      <AuthorizeComponent
        config={{
          privilege: 'ownership:read',
          subject: {
            id: '__filtered__',
          },
        }}
      >
        <OwnershipsTable tenant={tenant} />
      </AuthorizeComponent>
      <AuthorizeComponent
        config={{
          privilege: 'user-tenant-membership:read',
          subject: {
            id: '__filtered__',
          },
        }}
      >
        <MembershipsTable tenant={tenant} />
      </AuthorizeComponent>
    </>
  ) : null;
};

const OwnershipsTable = (props: { tenant: GetTenantDto }) => {
  const ownerships = ownershipQueries.useAll({});
  const roles = roleQueries.useAll({});

  return (
    <ContentSection heading="Ownerships">
      <SbaaTableAllInOne
        queryKeyPrefix="own"
        data={Object.values(ownerships?.data || {}).filter((o) => o.tenantId === props.tenant.id)}
        columns={[
          {
            accessorKey: 'displayName',
            cell: OwnershipsNameCell,
            header: 'Name',
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'resource',
            accessorFn: (info) =>
              info.edorg
                ? `Ed-Org - ${info.edorg.displayName}`
                : info.ods
                ? `Ods - ${info.ods.displayName}`
                : `Environment - ${info.sbe?.displayName}`,
            header: 'Resource',
            cell: ({ row: { original } }) =>
              original.edorg
                ? original.edorg.displayName
                : original.ods
                ? original.ods.displayName
                : original.sbe
                ? original.sbe.displayName
                : '-',
            filterFn: 'equalsString',
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
    </ContentSection>
  );
};

const MembershipsTable = (props: { tenant: GetTenantDto }) => {
  const roles = roleQueries.useAll({ optional: true });
  const userTenantMemberships = userTenantMembershipQueries.useAll({});
  const users = userQueries.useAll({});

  return (
    <ContentSection heading="User memberships">
      <SbaaTableAllInOne
        queryKeyPrefix="utm"
        data={Object.values(userTenantMemberships?.data || {}).filter(
          (m) => m.tenantId === props.tenant.id
        )}
        columns={[
          {
            accessorKey: 'displayName',
            cell: UtmGlobalNameCell,
            header: '',
            enableSorting: false,
          },
          {
            id: 'user',
            accessorFn: (info) => getRelationDisplayName(info.userId, users),
            header: 'User',
            cell: (info) => <UserGlobalLink id={info.row.original.userId} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'role',
            accessorFn: (info) => getRelationDisplayName(info.roleId, roles),
            header: 'Role',
            cell: (info) => <RoleGlobalLink id={info.row.original.roleId} query={roles} />,
            filterFn: 'equalsString',
            meta: {
              type: 'options',
            },
          },
          {
            id: 'createdDetailed',
            accessorKey: 'createdNumber',
            cell: ValueAsDate(),
            header: 'Created',
            meta: {
              type: 'date',
            },
          },
        ]}
      />
    </ContentSection>
  );
};
