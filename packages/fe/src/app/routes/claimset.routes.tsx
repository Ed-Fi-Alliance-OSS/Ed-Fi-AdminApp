import { Link, Text } from '@chakra-ui/react';
import { GetClaimsetDto, GetClaimsetMultipleDtoV2 } from '@edanalytics/models';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { RouteObject, Link as RouterLink, useParams } from 'react-router-dom';
import { ClaimsetPage } from '../Pages/Claimset/ClaimsetPage';
import { ClaimsetsPage } from '../Pages/Claimset/ClaimsetsPage';
import { CreateClaimset } from '../Pages/Claimset/CreateClaimsetPage';
import { ImportClaimsetsPage } from '../Pages/Claimset/ImportClaimsetsPage';
import { ClaimsetPageV2 } from '../Pages/ClaimsetV2/ClaimsetPage';
import { ClaimsetsPageV2 } from '../Pages/ClaimsetV2/ClaimsetsPage';
import { CopyClaimsetPage } from '../Pages/ClaimsetV2/CopyClaimset';
import { ImportClaimsetsPageV2 } from '../Pages/ClaimsetV2/ImportClaimsetsPage';
import { claimsetQueriesV1, claimsetQueriesV2 } from '../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded, withLoader } from '../helpers';
import { VersioningHoc } from '../helpers/VersioningHoc';
import { getEntityFromQuery } from '../helpers/getEntityFromQuery';

const ClaimsetBreadcrumbV1 = () => {
  const params = useParams() as { claimsetId: string };
  const { edfiTenant, edfiTenantId, teamId, asId } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV1.getOne({
      id: params.claimsetId,
      teamId,
      edfiTenant,
    })
  );
  return (claimset.data?.displayName ?? params.claimsetId) as unknown as JSX.Element;
};

const ClaimsetBreadcrumbV2 = () => {
  const params = useParams() as {
    claimsetId: string;
  };
  const { edfiTenant, asId: teamId } = useTeamEdfiTenantNavContextLoaded();
  const claimset = useQuery(
    claimsetQueriesV2.getOne({
      id: params.claimsetId,
      edfiTenant,
      teamId,
    })
  );
  return (claimset.data?.displayName ?? params.claimsetId) as unknown as JSX.Element;
};
export const claimsetCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/create',
  element: <CreateClaimset />,
  handle: { crumb: () => 'Create Claimset' },
};
export const claimsetCopyRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId/copy',
  element: <VersioningHoc v2={<CopyClaimsetPage />} />,
  handle: { crumb: () => 'Copy' },
};
export const claimsetImportRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/import',
  element: <VersioningHoc v1={<ImportClaimsetsPage />} v2={<ImportClaimsetsPageV2 />} />,
  handle: { crumb: () => 'Import Claimsets' },
};
export const claimsetIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId/',
  element: <VersioningHoc v1={<ClaimsetPage />} v2={<ClaimsetPageV2 />} />,
};

export const claimsetRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/:claimsetId',
  handle: {
    crumb: withLoader(() => (
      <VersioningHoc v1={<ClaimsetBreadcrumbV1 />} v2={<ClaimsetBreadcrumbV2 />} />
    )),
    fallbackCrumb: () => 'Claimset',
  },
};
export const claimsetsIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets/',
  element: <VersioningHoc v1={<ClaimsetsPage />} v2={<ClaimsetsPageV2 />} />,
};
export const claimsetsRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/claimsets',
  handle: { crumb: () => 'Claimsets' },
};

export const ClaimsetLinkV1 = (props: {
  id: number | string | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetClaimsetDto>, unknown>, 'data'>;
}) => {
  const claimset = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return claimset ? (
    <Link as="span">
      <RouterLink
        title="Go to claimset"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${claimset.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Claimset may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
export const ClaimsetLinkV2 = (props: {
  id: number | string | undefined;
  query: Pick<UseQueryResult<Record<string | number, GetClaimsetMultipleDtoV2>, unknown>, 'data'>;
}) => {
  const claimset = getEntityFromQuery(props.id, props.query);
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  return claimset ? (
    <Link as="span">
      <RouterLink
        title="Go to claimset"
        to={`/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${claimset.id}`}
      >
        {getRelationDisplayName(props.id, props.query)}
      </RouterLink>
    </Link>
  ) : props.id !== null && props.id !== undefined ? (
    <Text title="Claimset may have been deleted, or you lack access." as="i" color="gray.500">
      can't find &#8220;{props.id}&#8221;
    </Text>
  ) : null;
};
