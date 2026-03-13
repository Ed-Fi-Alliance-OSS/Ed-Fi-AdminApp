import { RouteObject } from 'react-router-dom';
import { RequestCertificationPage as RequestCertificationPageV2 } from '../Pages/CertificationV2/RequestCertificationPage';

export const sbEnvironmentGlobalCertRoute: RouteObject = {
  path: '/sb-environments/:sbEnvironmentId/request-certification',
  element: <RequestCertificationPageV2 />,
};