import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { useDeleteOwnership, useOwnership } from '../../api';
import { ownershipIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditOwnership } from './EditOwnership';
import { ViewOwnership } from './ViewOwnership';
import { ReactNode } from 'react';

export const OwnershipPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const deleteOwnership = useDeleteOwnership(() => {
    navigate(navToParentOptions);
  });
  const params = useParams({ from: ownershipIndexRoute.id });
  const ownership = useOwnership(params.ownershipId).data;
  const { edit } = useSearch({ from: ownershipIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {ownership?.displayName || 'Ownership'}
      </Heading>
      {ownership ? (
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
                  to: ownershipIndexRoute.fullPath,
                  params: (old: any) => old,
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              action={() => deleteOwnership.mutate(ownership.id)}
              headerText={`Delete ${ownership.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditOwnership /> : <ViewOwnership />}
        </Box>
      ) : null}
    </>
  );
};
