import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { useDeleteEdorg, useEdorg } from '../../api';
import { edorgIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditEdorg } from './EditEdorg';
import { ViewEdorg } from './ViewEdorg';
import { ReactNode } from 'react';

export const EdorgPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const deleteEdorg = useDeleteEdorg(() => {
    navigate(navToParentOptions);
  });
  const params = useParams({ from: edorgIndexRoute.id });
  const edorg = useEdorg(params.edorgId, params.sbeId).data;
  const { edit } = useSearch({ from: edorgIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {edorg?.displayName || 'Edorg'}
      </Heading>
      {edorg ? (
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
                  to: edorgIndexRoute.fullPath,
                  params: (old: any) => old,
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              action={() => deleteEdorg.mutate(edorg.id)}
              headerText={`Delete ${edorg.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditEdorg /> : <ViewEdorg />}
        </Box>
      ) : null}
    </>
  );
};
