import {
  Badge,
  Box,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Heading,
  Link,
  SimpleGrid,
  Text,
} from '@chakra-ui/react';
import { GetSessionDataDtoUtm } from '@edanalytics/models';
import { useAtomValue } from 'jotai';
import { Link as RouterLink } from 'react-router-dom';
import { LandingContent } from '../../Layout/Landing';
import { asTenantIdAtom } from '../../Layout/Nav';
import { useMe } from '../../api';
import { TenantHome } from './TenantHome';
import { PageTemplate } from '@edanalytics/common-ui';

export const GlobalHome = () => {
  const asId = useAtomValue(asTenantIdAtom);
  const me = useMe();
  if (me.data === null) {
    return <LandingContent />;
  } else {
    if (asId === undefined) {
      return <GlobalHomeComponent />;
    } else {
      return <TenantHome />;
    }
  }
};
const GlobalHomeComponent = () => {
  const me = useMe();
  const utms = me.data?.userTenantMemberships ?? [];
  return utms.length ? (
    <PageTemplate customContentBox title="Your tenants">
      <SimpleGrid w="fit-content" columns={3} spacing={4}>
        {utms.map((utm) => (
          <UtmCard key={utm.id} utm={utm} />
        ))}
      </SimpleGrid>
    </PageTemplate>
  ) : (
    <EmptyState />
  );
};

const UtmCard = ({ utm }: { utm: GetSessionDataDtoUtm }) => {
  return (
    <Card maxW="xs" variant="elevated">
      <CardHeader pb={0}>
        <Heading color="gray.600" size="md">
          {utm.tenant.displayName}
        </Heading>
      </CardHeader>
      <CardBody>
        <Text>
          Your role: <Badge>{utm.role?.displayName ?? '(inactive)'}</Badge>.
        </Text>
        <Text>Member since {utm.createdShort}.</Text>
      </CardBody>
      <CardFooter>
        <Link as={RouterLink} to={`/as/${utm.tenant.id}`} color="blue.500">
          Enter tenant &rarr;
        </Link>
      </CardFooter>
    </Card>
  );
};

const EmptyState = () => (
  <Box>Well, not much to see here. Content when no tenant memberships exist TBD.</Box>
);
