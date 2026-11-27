import { RouteObject } from 'react-router';
import { config } from '../../config/config';
import { CertificationDashboardPage } from '../Pages/CertificationDashboard/CertificationDashboardPage';
import { CertificationQueuePage } from '../Pages/CertificationQueue/CertificationQueuePage';
import { CertificationReviewPage } from '../Pages/CertificationReview/CertificationReviewPage';
import { CertificationReviewStepsPage } from '../Pages/CertificationReview/CertificationReviewStepsPage';
import { routeDefinitions } from './paths';

/**
 * Global Certification dashboard, review queue and the review page of one run. Not
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
          path: routeDefinitions.certificationQueue.index,
          element: <CertificationQueuePage />,
          handle: { crumb: () => 'Review queue' },
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
