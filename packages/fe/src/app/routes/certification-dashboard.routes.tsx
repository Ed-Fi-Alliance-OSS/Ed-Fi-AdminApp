import { RouteObject } from 'react-router';
import { config } from '../../config/config';
import { CertificationDashboardPage } from '../Pages/CertificationDashboard/CertificationDashboardPage';
import { CertificationReviewPage } from '../Pages/CertificationReview/CertificationReviewPage';
import { CertificationReviewStepsPage } from '../Pages/CertificationReview/CertificationReviewStepsPage';
import { routeDefinitions } from './paths';

/**
 * Global Certification dashboard (AC-672) and the review page of one run (AC-660). Not
 * registered at all while the certification flag is off.
 */
export const getCertificationDashboardRoutes = (): RouteObject[] =>
  config.showRequestCertification
    ? [
        {
          path: routeDefinitions.certificationDashboard.index,
          element: <CertificationDashboardPage />,
          handle: { crumb: () => 'Certification dashboard' },
        },
        {
          path: routeDefinitions.certificationReview.index,
          element: <CertificationReviewPage />,
          handle: { crumb: () => 'Review' },
        },
        {
          path: routeDefinitions.certificationReviewSteps.index,
          element: <CertificationReviewStepsPage />,
          handle: { crumb: () => 'Steps' },
        },
      ]
    : [];
