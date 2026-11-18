import { RouteObject } from 'react-router';
import { config } from '../../config/config';
import { CertificationDashboardPage } from '../Pages/CertificationDashboard/CertificationDashboardPage';
import { routeDefinitions } from './paths';

/** Global Certification dashboard (AC-672). Not registered at all while the certification flag is off. */
export const getCertificationDashboardRoutes = (): RouteObject[] =>
  config.showRequestCertification
    ? [
        {
          path: routeDefinitions.certificationDashboard.index,
          element: <CertificationDashboardPage />,
          handle: { crumb: () => 'Certification dashboard' },
        },
      ]
    : [];
