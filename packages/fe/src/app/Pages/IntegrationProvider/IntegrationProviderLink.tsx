import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useGetManyIntegrationProviders } from '../../api-v2';
import { paths } from '../../routes/paths';

export const IntegrationProviderLink = (props: { id: number | undefined }) => {
  const integrationProviders = useGetManyIntegrationProviders({}).data;

  if (!props.id) {
    return (
      <Text
        title="Integration provider may have been deleted, or you lack access."
        as="i"
        color="gray.500"
      >
        can't find &#8220;{props.id}&#8221;
      </Text>
    );
  }

  const integrationProvider = integrationProviders?.find((p) => p.id === props.id);
  return (
    <Link as="span">
      <RouterLink title="Go to integration" to={paths.integrationProvider.id(props.id)}>
        {integrationProvider?.name ?? props.id}
      </RouterLink>
    </Link>
  );
};
