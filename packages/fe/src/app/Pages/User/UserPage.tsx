import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { useDeleteUser, useUser } from '../../api';
import { useNavToParent } from '../../helpers';
import { userIndexRoute } from '../../routes';
import { EditUser } from './EditUser';
import { ViewUser } from './ViewUser';

export const UserPage = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const deleteUser = useDeleteUser(() => {
    navigate(navToParentOptions);
  });
  const userId: string = useParams({ from: userIndexRoute.id }).userId;
  const user = useUser(userId).data;
  const { edit } = useSearch({ from: userIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {user?.displayName || 'User'}
      </Heading>
      {user ? (
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
                  to: userIndexRoute.fullPath,
                  params: { userId },
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              action={() => deleteUser.mutate(user.id)}
              headerText={`Delete ${user.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditUser /> : <ViewUser />}
        </Box>
      ) : null}
    </>
  );
};
