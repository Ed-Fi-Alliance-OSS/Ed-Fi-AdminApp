import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbProps,
  StyleProps,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Link as RouterLink, generatePath, useMatches, useParams } from 'react-router-dom';
import { flatRoutes } from '../routes';

export const Breadcrumbs = (props: BreadcrumbProps & StyleProps) => {
  const matches = useMatches();
  const params = useParams() as { asId?: string };
  const lastMatch = matches[matches.length - 1];
  const breadcrumbs = flatRoutes
    .filter((m) => m.path && lastMatch?.handle?.path?.startsWith(m.path) && m.handle?.crumb)
    .sort((a, b) => {
      const aPath = a.path;
      const bPath = b.path;
      return aPath && bPath ? (aPath.startsWith(bPath) ? 1 : bPath.startsWith(aPath) ? -1 : 0) : 0;
    });

  const [terminalItemRef, setTerminalItemRef] = useState<HTMLAnchorElement | null>(null);

  useEffect(() => {
    // This non-reactive approach is ugly, but it's harmless and a way to avoid making the structure of the breadcrumb functions into a big deal.
    const titlePoll = setInterval(() => {
      if (terminalItemRef?.innerText !== undefined) {
        document.title =
          terminalItemRef?.innerText === 'Home'
            ? 'Starting Blocks'
            : terminalItemRef?.innerText + ' | Starting Blocks';
      } else {
        document.title = 'Starting Blocks';
      }
    }, 500);
    return () => {
      clearInterval(titlePoll);
    };
  }, [terminalItemRef?.innerText]);

  return (
    <Breadcrumb
      size="sm"
      spacing={1}
      color="gray.500"
      separator={
        <Text color="gray.400" mx="0.2em" lineHeight={0}>
          /
        </Text>
      }
      {...props}
    >
      <BreadcrumbItem>
        <BreadcrumbLink as={RouterLink} to={params.asId ? `/as/${params.asId}` : '/'}>
          Home
        </BreadcrumbLink>
      </BreadcrumbItem>
      {breadcrumbs.map((route, i) => {
        const Breadcrumb = route.handle.crumb!;
        const FallbackBreadcrumb = route.handle.fallbackCrumb ?? ((() => '(error ocurred)') as any);
        const path = route.path!;
        const to = generatePath(path, lastMatch.params);
        return (
          <BreadcrumbItem key={to + i}>
            <BreadcrumbLink
              ref={(newRef) => {
                i === breadcrumbs.length - 1 && setTerminalItemRef(newRef);
              }}
              as={RouterLink}
              to={to}
            >
              <ErrorBoundary FallbackComponent={() => <FallbackBreadcrumb />}>
                <Breadcrumb />
              </ErrorBoundary>
            </BreadcrumbLink>
          </BreadcrumbItem>
        );
      })}
    </Breadcrumb>
  );
};
