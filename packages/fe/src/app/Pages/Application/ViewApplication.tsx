import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  HStack,
  Stack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useParams, useSearch } from '@tanstack/router';
import { applicationQueries } from '../../api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { applicationRoute, applicationIndexRoute } from '../../routes';

export const ViewApplication = () => {
  const params = useParams({ from: applicationRoute.id });
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: applicationIndexRoute.id });

  return application ? (
    <>
      {/* TODO: replace this with real content */}
      <Text as="strong">Id</Text>
      <Text>{application.id}</Text>
    </>
  ) : null;
};
