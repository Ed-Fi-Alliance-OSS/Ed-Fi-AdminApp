import { Box, Button, Heading } from '@chakra-ui/react';
import { useNavigate, useSearch } from '@tanstack/router';
import { BiEdit } from 'react-icons/bi';
import { useMe } from '../../api';
import { EditAccount } from './EditAccount';
import { ViewAccount } from './ViewAccount';
import { accountRouteGlobal } from '../../routes';

export const AccountPage = () => {
  const me = useMe();
  const user = me.data?.user;
  const navigate = useNavigate();

  const edit = useSearch({ from: accountRouteGlobal.id }).edit;

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {user?.displayName || 'User'}
      </Heading>
      {user ? (
        <Box maxW="40em" borderTop="1px solid" borderColor="gray.200">
          <Box textAlign="right">
            <Button
              isDisabled={edit}
              size="sm"
              iconSpacing={1}
              leftIcon={<BiEdit />}
              variant="link"
              onClick={() => {
                navigate({
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
          </Box>
          {edit ? <EditAccount /> : <ViewAccount />}
        </Box>
      ) : null}
    </>
  );
};
