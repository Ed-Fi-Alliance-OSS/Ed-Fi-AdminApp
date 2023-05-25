import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Spinner,
  useBoolean,
  useToast,
} from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { ReactNode } from 'react';
import { BiEdit, BiRefresh, BiTrash } from 'react-icons/bi';
import { GoRadioTower } from 'react-icons/go';
import {
  sbeQueries,
  useSbeCheckConnection,
  useSbeRefreshResources,
} from '../../api';
import { useNavToParent } from '../../helpers';
import { sbeGlobalIndexRoute } from '../../routes';
import { EditSbeGlobal } from './EditSbeGlobal';
import { ViewSbeGlobal } from './ViewSbeGlobal';

export const SbeGlobalPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: sbeGlobalIndexRoute.id });
  const deleteSbe = sbeQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
  });
  const sbe = sbeQueries.useOne({
    id: params.sbeId,
  }).data;
  const { edit } = useSearch({ from: sbeGlobalIndexRoute.id });
  const toast = useToast();
  const [checkLoading, setCheckLoading] = useBoolean(false);
  const [refreshLoading, setRefreshLoading] = useBoolean(false);

  const checkConnection = useSbeCheckConnection();
  const refreshResources = useSbeRefreshResources();

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
              title="Reload ODSs and Ed-Orgs from Starting Blocks and sync to the SBAA database."
              isDisabled={refreshLoading}
              iconSpacing={1}
              leftIcon={refreshLoading ? <Spinner size="sm" /> : <BiRefresh />}
              onClick={async () => {
                setRefreshLoading.on();
                try {
                  const result = await refreshResources.mutateAsync(sbe);
                  toast({
                    title: 'Refresh completed.',
                    description: `${result.odsCount} total ODS's. ${result.edorgCount} total Ed-Orgs.`,
                    duration: 5000,
                    isClosable: true,
                  });
                } catch (refreshFailed) {
                  toast({
                    title: 'Refresh failed.',
                    description: String(refreshFailed),
                    duration: 20000,
                    isClosable: true,
                  });
                }
                setRefreshLoading.off();
              }}
            >
              Sync contents
            </Button>
            <Button
              title="Test connections and credentials to the Ed-Fi Admin API and Starting Blocks, but don't run a sync or change any data."
              isDisabled={checkLoading}
              iconSpacing={1}
              leftIcon={checkLoading ? <Spinner size="sm" /> : <GoRadioTower />}
              onClick={async () => {
                setCheckLoading.on();
                const result = await checkConnection.mutateAsync(sbe);
                toast({
                  title: 'Connection check completed.',
                  description:
                    result.adminApi && result.sbMeta
                      ? 'Connection successful.'
                      : result.adminApi
                      ? 'Admin API connection successful. SB meta unsuccessful.'
                      : result.sbMeta
                      ? 'SB meta connection successful. Admin API unsuccessful.'
                      : 'Connection unsuccessful.',
                  duration: 9000,
                  colorScheme:
                    result.adminApi && result.sbMeta
                      ? 'green'
                      : result.adminApi || result.sbMeta
                      ? 'yellow'
                      : 'red',
                  isClosable: true,
                });
                setCheckLoading.off();
              }}
            >
              Check connection
            </Button>
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
              Edit config
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

          {edit ? <EditSbeGlobal /> : <ViewSbeGlobal />}
        </Box>
      ) : null}
    </>
  );
};
