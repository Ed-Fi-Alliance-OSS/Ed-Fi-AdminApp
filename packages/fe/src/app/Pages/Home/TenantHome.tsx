import { Heading } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { AuthorizeComponent, sbeAuthConfig, useNavContext } from '../../helpers';
import { SbesCardList } from './SbesCardList';

export const TenantHome = () => {
  const asId = useNavContext().asId!;
  return (
    <PageTemplate customContentBox title="Home">
      <AuthorizeComponent config={sbeAuthConfig('__filtered__', asId, 'tenant.sbe:read')}>
        <>
          <Heading size="md" mb={5} mt={6}>
            Environments
          </Heading>
          <SbesCardList />
        </>
      </AuthorizeComponent>
    </PageTemplate>
  );
};
