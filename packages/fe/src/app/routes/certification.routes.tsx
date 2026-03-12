import { RouteObject } from 'react-router-dom';
import { RequestCertificationPage } from '../Pages/Certification/RequestCertificationPage';

export const requestCertificationIndexRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/request-certification/',
  element: <RequestCertificationPage />,
};

export const requestCertificationRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/:edfiTenantId/applications/:applicationId/request-certification',
  handle: { crumb: () => 'Request certification' },
};
