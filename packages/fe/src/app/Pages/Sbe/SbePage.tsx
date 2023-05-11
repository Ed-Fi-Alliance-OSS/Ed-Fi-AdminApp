import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { sbeQueries, userQueries } from '../../api';
import { sbeIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditSbe } from './EditSbe';
import { ViewSbe } from './ViewSbe';
import { ReactNode } from 'react';

export const SbePage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: sbeIndexRoute.id });
  const deleteSbe = sbeQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    tenantId: params.asId,
  });
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: sbeIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {sbe?.displayName || 'Sbe'}
      </Heading>
      {sbe ? (
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
              action={() => deleteSbe.mutate(sbe.id)}
              headerText={`Delete ${sbe.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditSbe /> : <ViewSbe />}
        </Box>
      ) : null}
    </>
  );
};
