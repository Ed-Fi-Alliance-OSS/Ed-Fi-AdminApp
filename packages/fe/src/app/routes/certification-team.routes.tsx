import { RouteObject } from 'react-router';
import { CertificationLayout } from '../Pages/CertificationV2/CertificationAuthContext';
import { CertificationPageExecution } from '../Pages/CertificationV2/CertificationPageExecution';
import { CertificationScenariosPage } from '../Pages/CertificationV2/CertificationScenariosPage';
import { MyProductsPage } from '../Pages/MyProducts/MyProductsPage';
import { routeDefinitions } from './paths';

/**
 * The team's certification pages (AC-651). One pathless parent holds the in-memory ODS token:
 * it is validated in the Request New Certification popup on My products and must survive
 * moving to the run's Scenarios page and on to its steps. Leaving these pages drops it.
 * The children keep absolute paths, like every other team route.
 */
const certificationRoute: RouteObject = {
  element: <CertificationLayout />,
  children: [
    {
      path: routeDefinitions.asTeam.myProducts.index,
      element: <MyProductsPage />,
      handle: { crumb: () => 'My products' },
    },
    {
      path: routeDefinitions.asTeam.certification.run,
      element: <CertificationScenariosPage />,
      handle: { crumb: () => 'Scenarios' },
    },
    {
      path: routeDefinitions.asTeam.certification.runExecution,
      element: <CertificationPageExecution />,
      handle: { crumb: () => 'Steps' },
    },
  ],
};

export const certificationTeamRoutes = [certificationRoute];
