import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { roleQueries, userQueries } from '../../api';
import { roleIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditRole } from './EditRole';
import { ViewRole } from './ViewRole';
import { ReactNode } from 'react';

export const RolePage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: roleIndexRoute.id });
  const deleteRole = roleQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    tenantId: params.asId,
  });
  const role = roleQueries.useOne({
    id: params.roleId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: roleIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {role?.displayName || 'Role'}
      </Heading>
      {role ? (
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
              action={() => deleteRole.mutate(role.id)}
              headerText={`Delete ${role.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditRole /> : <ViewRole />}
        </Box>
      ) : null}
    </>
  );
};
