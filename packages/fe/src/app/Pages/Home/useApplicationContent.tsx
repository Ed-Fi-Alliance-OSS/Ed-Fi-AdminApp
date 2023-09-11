import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Heading,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  Tab,
  Tooltip,
} from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import {
  GetClaimsetDto,
  GetEdorgDto,
  GetSbeDto,
  createEdorgCompositeNaturalKey,
} from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { BiErrorCircle } from 'react-icons/bi';
import { applicationQueries, claimsetQueries, edorgQueries } from '../../api';
import { queryClient } from '../../app';
import {
  AuthorizeConfig,
  authorize,
  getRelationDisplayName,
  useNavContext,
  usePrivilegeCacheForConfig,
} from '../../helpers';
import { ClaimsetLink, EdorgLink } from '../../routes';
import { NameCell } from '../Application/NameCell';
import { useMultiApplicationActions } from '../Application/useApplicationActions';

export const useApplicationContent = (props: { sbe: GetSbeDto }) => {
  const asId = useNavContext().asId!;
  const appAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: Number(asId),
    },
  };
  const queryClient = useQueryClient();

  const odsAuth: AuthorizeConfig = {
    subject: { id: '__filtered__', sbeId: props.sbe.id, tenantId: Number(asId) },
    privilege: 'tenant.sbe.ods:read',
  };
  usePrivilegeCacheForConfig([appAuth, odsAuth]);
  const actions = useMultiApplicationActions({ sbeId: props.sbe.id, tenantId: asId });

  return authorize({ queryClient, config: appAuth })
    ? {
        Stat: (
          <Stat flex="0 0 auto">
            <StatLabel>Applications</StatLabel>
            <ErrorBoundary
              FallbackComponent={(arg: { error: { message: string } }) => (
                <Tooltip label={arg.error.message}>
                  <StatNumber>
                    <Icon fontSize="xl" as={BiErrorCircle} />
                  </StatNumber>
                </Tooltip>
              )}
            >
              <ApplicationStat sbe={props.sbe} />
            </ErrorBoundary>
          </Stat>
        ),
        Tab: <Tab>Applications</Tab>,
        AccordionItem: (
          <AccordionItem>
            <AccordionButton>
              <Heading fontWeight="medium" fontSize="md" as="span" flex="1" textAlign="left">
                Applications
              </Heading>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={10}>
              <ErrorBoundary
                FallbackComponent={(arg: { error: { message: string } }) => (
                  <Alert status="error">
                    <AlertIcon />
                    {arg.error.message}
                  </Alert>
                )}
              >
                <ApplicationTable sbe={props.sbe} />
              </ErrorBoundary>
            </AccordionPanel>
          </AccordionItem>
        ),
      }
    : {
        Stat: null,
        AccordionItem: null,
      };
};

export const ApplicationTable = (props: { sbe: GetSbeDto }) => {
  const asId = useNavContext().asId!;
  const appAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: asId,
    },
  };
  const applications = applicationQueries.useAll({
    optional: true,
    tenantId: asId,
    sbeId: props.sbe.id,
  });
  const edorgs = edorgQueries.useAll({
    optional: true,
    tenantId: asId,
    sbeId: props.sbe.id,
  });
  const odsAuth: AuthorizeConfig = {
    subject: { id: '__filtered__', sbeId: props.sbe.id, tenantId: asId },
    privilege: 'tenant.sbe.ods:read',
  };
  usePrivilegeCacheForConfig([appAuth, odsAuth]);
  const edorgsByEdorgId = {
    ...edorgs,
    data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
      map[
        createEdorgCompositeNaturalKey({
          educationOrganizationId: edorg.educationOrganizationId,
          odsDbName: edorg.odsDbName,
        })
      ] = edorg;
      return map;
    }, {}),
  };
  const claimsets = claimsetQueries.useAll({
    optional: true,
    sbeId: props.sbe.id,
    tenantId: asId,
  });
  const claimsetsByName = {
    ...claimsets,
    data: Object.values(claimsets.data ?? {}).reduce<Record<string, GetClaimsetDto>>(
      (map, claimset) => {
        map[claimset.name] = claimset;
        return map;
      },
      {}
    ),
  };

  return (
    <DataTable
      queryKeyPrefix={`${props.sbe.id}_app`}
      pageSizes={[5, 10, 15]}
      data={Object.values(applications?.data || {})}
      columns={[
        {
          accessorKey: 'displayName',
          cell: NameCell,
          header: 'Name',
        },
        {
          id: 'edorg',
          accessorFn: (info) =>
            getRelationDisplayName(
              createEdorgCompositeNaturalKey({
                educationOrganizationId: info.educationOrganizationId,
                odsDbName: 'EdFi_Ods_' + info.odsInstanceName,
              }),
              edorgsByEdorgId
            ),
          header: 'Education organization',
          cell: (info) => (
            <EdorgLink
              query={edorgs}
              id={
                edorgsByEdorgId.data[
                  createEdorgCompositeNaturalKey({
                    educationOrganizationId: info.row.original.educationOrganizationId,
                    odsDbName: 'EdFi_Ods_' + info.row.original.odsInstanceName,
                  })
                ]?.id
              }
            />
          ),
        },
        {
          id: 'claimest',
          accessorFn: (info) => getRelationDisplayName(info.claimSetName, claimsetsByName),
          header: 'Claimset',
          cell: (info) => (
            <ClaimsetLink
              query={claimsets}
              id={claimsetsByName.data[info.row.original.claimSetName]?.id}
            />
          ),
        },
      ]}
    />
  );
};

export const ApplicationStat = (props: { sbe: GetSbeDto }) => {
  const asId = useNavContext().asId!;
  const appAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.edorg.application:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: asId,
    },
  };
  const applications = applicationQueries.useAll({
    optional: false,
    tenantId: asId,
    sbeId: props.sbe.id,
  });

  usePrivilegeCacheForConfig([appAuth]);

  return authorize({ queryClient, config: appAuth }) ? (
    <StatNumber>{Object.keys(applications.data ?? {}).length}</StatNumber>
  ) : null;
};
