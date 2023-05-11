import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { applicationQueries, userQueries } from '../../api';
import { applicationIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditApplication } from './EditApplication';
import { ViewApplication } from './ViewApplication';
import { ReactNode } from 'react';

export const ApplicationPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: applicationIndexRoute.id });
  const deleteApplication = applicationQueries.useDelete({
    sbeId: params.sbeId,
    tenantId: params.asId,
    callback: () => {
      navigate(navToParentOptions);
    },
  });
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: applicationIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {application?.displayName || 'Application'}
      </Heading>
      {application ? (
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
              action={() => deleteApplication.mutate(application.id)}
              headerText={`Delete ${application.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditApplication /> : <ViewApplication />}
        </Box>
      ) : null}
    </>
  );
};
