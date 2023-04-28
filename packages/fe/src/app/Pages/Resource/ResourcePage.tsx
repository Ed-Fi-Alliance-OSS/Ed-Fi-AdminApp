import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { useDeleteResource, useResource } from '../../api';
import { resourceIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditResource } from './EditResource';
import { ViewResource } from './ViewResource';
import { ReactNode } from 'react';

export const ResourcePage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const deleteResource = useDeleteResource(() => {
    navigate(navToParentOptions);
  });
  const params = useParams({ from: resourceIndexRoute.id });
  const resource = useResource(params.resourceId).data;
  const { edit } = useSearch({ from: resourceIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {resource?.displayName || 'Resource'}
      </Heading>
      {resource ? (
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
                  to: resourceIndexRoute.fullPath,
                  params: (old: any) => old,
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              action={() => deleteResource.mutate(resource.id)}
              headerText={`Delete ${resource.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditResource /> : <ViewResource />}
        </Box>
      ) : null}
    </>
  );
};
