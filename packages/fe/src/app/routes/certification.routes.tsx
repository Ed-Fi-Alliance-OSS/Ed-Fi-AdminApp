import { RouteObject } from 'react-router-dom';
import { VersioningHoc } from '../helpers';
import { RequestCertificationPage as RequestCertificationPageV1 } from '../Pages/Certification/RequestCertificationPage';
import { RequestCertificationPage as RequestCertificationPageV2 } from '../Pages/CertificationV2/RequestCertificationPage';

export const requestCertificationIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/request-certification/',
  element: <VersioningHoc v1={<RequestCertificationPageV1 />} v2={<RequestCertificationPageV2 />} />,
};

export const requestCertificationRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/request-certification',
  handle: { crumb: () => 'Request certification' },
};
