import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  FormLabel,
  Grid,
  HStack,
  Stack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/router';
import {
  applicationQueries,
  claimsetQueries,
  edorgQueries,
  vendorQueries,
} from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  applicationRoute,
  applicationIndexRoute,
  EdorgLink,
  VendorLink,
  ClaimsetLink,
} from '../../routes';

export const ViewApplication = () => {
  const params = useParams({ from: applicationRoute.id });
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: applicationIndexRoute.id });

  const edorgs = edorgQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  const vendors = vendorQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const claimsets = claimsetQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });

  const edorgByEdorgId = Object.values(edorgs.data ?? {}).find(
    (e) =>
      e.educationOrganizationId === String(application?.educationOrganizationId)
  );
  const claimsetByName = Object.values(claimsets.data ?? {}).find(
    (e) => e.name === application?.claimSetName
  );

  return application ? (
    <>
      <FormLabel as="p">Application name</FormLabel>
      <Text>{application.displayName}</Text>
      <FormLabel as="p">Ed-org</FormLabel>
      <EdorgLink id={edorgByEdorgId?.id} query={edorgs} />
      <FormLabel as="p">Vendor</FormLabel>
      {/* <VendorLink id={application.} > */}
      <Text>-</Text>
      <FormLabel as="p">Claimset</FormLabel>
      <ClaimsetLink
        sbeId={params.sbeId}
        id={claimsetByName?.id}
        query={claimsets}
      />
    </>
  ) : null;
};
