import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { tenantQueries, userQueries } from '../../api';
import { tenantIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditTenant } from './EditTenant';
import { ViewTenant } from './ViewTenant';
import { ReactNode } from 'react';

export const TenantPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: tenantIndexRoute.id });
  const deleteTenant = tenantQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
  });
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;
  const { edit } = useSearch({ from: tenantIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {tenant?.displayName || 'Tenant'}
      </Heading>
      {tenant ? (
        <Box maxW="40em" borderTop="1px solid" borderColor="gray.200">
          <ButtonGroup
            spacing={6}
            display="flex"
            size="sm"
            variant="link"
            justifyContent="end"
          >
            <Button
              isDisabled={edit}
              iconSpacing={1}
              leftIcon={<BiEdit />}
              onClick={() => {
                navigate({
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              action={() => deleteTenant.mutate(tenant.id)}
              headerText={`Delete ${tenant.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditTenant /> : <ViewTenant />}
        </Box>
      ) : null}
    </>
  );
};
