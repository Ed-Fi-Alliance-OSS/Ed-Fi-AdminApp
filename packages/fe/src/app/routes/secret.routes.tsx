import { Suspense, lazy } from 'react';
import { RouteObject } from 'react-router-dom';
const SecretPage = lazy(() => import('../Pages/Secret/SecretPage'));

export const secretRoute: RouteObject = {
  path: '/secret/',
  element: (
    <Suspense fallback={<div>Loading...</div>}>
      <SecretPage />
    </Suspense>
  ),
};
