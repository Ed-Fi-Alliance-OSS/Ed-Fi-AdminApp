import { Alert, AlertIcon, Text } from '@chakra-ui/react';
import { UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { ApiClientEntity, useApiClientConfig } from './apiClientConfig';

// The standing explanation shown when an Application is down to its last
// credential (mandated verbatim copy — see
// docs/design/ac-616-application-disappears.md), rendered on both the
// credentials list page (ApiClientsPage.tsx) and the credential detail page
// (ApiClientPage.tsx). It complements, rather than replaces, the `title`
// tooltip on the disabled Delete action in useApiClientActions.tsx: that
// tooltip is the point-of-action explanation (visible on hover/focus of the
// disabled button), while this legend is visible whenever the restriction
// applies, whether or not the user has reached for Delete yet.
export const CredentialsRequiredLegend = ({ applicationId }: { applicationId: number }) => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { queries } = useApiClientConfig();

  // Same query key NameCell.tsx and useApiClientActions.tsx already use for
  // this Application's credentials, so TanStack Query serves this from cache
  // rather than issuing another request.
  // TypeScript cannot resolve union-typed overloaded functions; cast to the
  // actual return type. Same workaround as ApiClientsPage.tsx/NameCell.tsx.
  // `throwOnError` is overridden to false, as in useApiClientActions.tsx, so a
  // failed count cannot throw during render — rendering nothing is the safe
  // failure mode for a hint whose enforcement actually lives in the BFF's 409.
  const applicationApiClients = useQuery({
    ...(queries.getAll(
      {
        teamId,
        edfiTenant,
      },
      {
        applicationId,
      }
    ) as UseQueryOptions<Record<string | number, ApiClientEntity>>),
    throwOnError: false,
  });

  if (applicationApiClients.isPending || applicationApiClients.isError) return null;
  if (Object.keys(applicationApiClients.data ?? {}).length !== 1) return null;

  return (
    <Alert status="warning" mt={4}>
      <AlertIcon />
      <Text fontSize="sm">
        An Application needs at least one credential to work. To replace a credential, create the
        new one first, then delete the old one.
      </Text>
    </Alert>
  );
};
