import { generatePath, useMatches, useParams } from 'react-router-dom';
import { flatRoutes } from '../routes';
import _ from 'lodash';

/**
 * Navigate up one level in the route tree. Useful for redirecting after deletion of a resource whose page you were on.
 * @returns Router nav options or undefined
 */
export const useNavToParent = () => {
  const matches = useMatches();
  const params = useParams();
  const lastMatch = matches[matches.length - 1];
  const breadcrumbs = _.uniq(
    flatRoutes
      .filter((m) => m.path && lastMatch?.handle?.path?.startsWith(m.path))
      .map((r) => r.path?.replace(/\/$/, ''))
      .sort((a, b) => {
        const aPath = a;
        const bPath = b;
        return aPath && bPath
          ? aPath.startsWith(bPath)
            ? 1
            : bPath.startsWith(aPath)
            ? -1
            : 0
          : 0;
      })
  );

  return breadcrumbs.length > 1 ? generatePath(breadcrumbs.slice(-2)[0] ?? '/', params) : '/';
};
