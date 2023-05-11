import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { claimsetQueries, userQueries } from '../../api';
import { claimsetIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditClaimset } from './EditClaimset';
import { ViewClaimset } from './ViewClaimset';
import { ReactNode } from 'react';

export const ClaimsetPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: claimsetIndexRoute.id });
  const deleteClaimset = claimsetQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const claimset = claimsetQueries.useOne({
    enabled: params.asId !== undefined,
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: claimsetIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {claimset?.displayName || 'Claimset'}
      </Heading>
      {claimset ? (
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
              action={() => deleteClaimset.mutate(claimset.id)}
              headerText={`Delete ${claimset.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction>
          </ButtonGroup>

          {edit ? <EditClaimset /> : <ViewClaimset />}
        </Box>
      ) : null}
    </>
  );
};
