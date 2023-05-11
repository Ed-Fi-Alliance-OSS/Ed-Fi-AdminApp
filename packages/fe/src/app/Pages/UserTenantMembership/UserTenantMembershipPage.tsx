import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { userTenantMembershipQueries, userQueries } from '../../api';
import { userTenantMembershipIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditUserTenantMembership } from './EditUserTenantMembership';
import { ViewUserTenantMembership } from './ViewUserTenantMembership';
import { ReactNode } from 'react';

export const UserTenantMembershipPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: userTenantMembershipIndexRoute.id });
  const deleteUserTenantMembership = userTenantMembershipQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    tenantId: params.asId,
  });
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: userTenantMembershipIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {userTenantMembership?.displayName || 'UserTenantMembership'}
      </Heading>
      {userTenantMembership ? (
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
              action={() =>
                deleteUserTenantMembership.mutate(userTenantMembership.id)
              }
              headerText={`Delete ${userTenantMembership.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditUserTenantMembership /> : <ViewUserTenantMembership />}
        </Box>
      ) : null}
    </>
  );
};
