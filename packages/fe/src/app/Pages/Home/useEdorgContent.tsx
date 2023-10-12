import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  HStack,
  Heading,
  Link,
  Stat,
  StatLabel,
  StatNumber,
  Tab,
} from '@chakra-ui/react';
import {
  SbaaTable,
  SbaaTableFilters,
  SbaaTablePagination,
  SbaaTableProvider,
  SbaaTableSearch,
} from '@edanalytics/common-ui';
import { GetEdorgDto, GetSbeDto } from '@edanalytics/models';
import { CellContext } from '@tanstack/react-table';
import { Link as RouterLink } from 'react-router-dom';
import { edorgQueries, odsQueries } from '../../api';
import {
  AuthorizeConfig,
  arrayElemIf,
  getRelationDisplayName,
  useAuthorize,
  useNavContext,
} from '../../helpers';
import { EdorgLink, OdsLink } from '../../routes';
import { NameCell } from '../Edorg/NameCell';
import { SbeSyncDateValue } from '../Sbe/SbeSyncDate';

export const useEdorgContent = (props: { sbe: GetSbeDto }) => {
  const asId = useNavContext().asId!;
  const edorgs = edorgQueries.useAll({
    optional: true,
    tenantId: asId,
    sbeId: props.sbe.id,
  });
  const authConfig: AuthorizeConfig = {
    privilege: 'tenant.sbe.edorg:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: Number(asId),
    },
  };
  const odsAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.ods:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: Number(asId),
    },
  };
  const odss = odsQueries.useAll({ optional: true, tenantId: asId, sbeId: props.sbe.id });
  const canShowOds = useAuthorize(odsAuth);
  const canShow = useAuthorize(authConfig);
  return canShow
    ? {
        Stat: (
          <Stat flex="0 0 auto">
            <StatLabel>Ed-Orgs</StatLabel>
            <StatNumber
              color="teal.600"
              as={RouterLink}
              to={`/as/${asId}/sbes/${props.sbe.id}/edorgs`}
              _hover={{ textDecoration: 'underline' }}
            >
              {Object.keys(edorgs.data ?? {}).length}
            </StatNumber>
          </Stat>
        ),
        Tab: <Tab>Ed-Orgs</Tab>,
        AccordionItem: (
          <AccordionItem>
            <AccordionButton>
              <Heading fontWeight="medium" fontSize="md" as="span" flex="1" textAlign="left">
                Ed-Orgs
              </Heading>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={10}>
              <SbeSyncDateValue mb={2} display="block" w="fit-content" />
              <SbaaTableProvider
                queryKeyPrefix={`${props.sbe.id}_edorg`}
                pageSizes={[5, 10, 15]}
                data={Object.values(edorgs?.data || {})}
                columns={[
                  {
                    accessorKey: 'displayName',
                    cell: NameCell,
                    header: 'Name',
                  },
                  {
                    id: 'parent',
                    accessorFn: (info) => getRelationDisplayName(info.parentId, edorgs),
                    header: 'Parent Ed-Org',
                    cell: (info) => <EdorgLink query={edorgs} id={info.row.original.parentId} />,
                  },
                  ...arrayElemIf(canShowOds, {
                    id: 'ods',
                    accessorFn: (info: GetEdorgDto) => getRelationDisplayName(info.odsId, odss),
                    header: 'ODS',
                    cell: (info: CellContext<GetEdorgDto, unknown>) => (
                      <OdsLink query={odss} id={info.row.original.odsId} />
                    ),
                  }),
                  {
                    id: 'discriminator',
                    accessorFn: (info) => info.discriminator,
                    header: 'Type',
                  },
                ]}
              >
                <Box mb={4}>
                  <HStack justify="space-between" align="end">
                    <SbaaTableSearch />
                    <Link
                      alignSelf="center"
                      color="blue.500"
                      to={`/as/${asId}/sbes/${props.sbe.id}/edorgs`}
                      as={RouterLink}
                    >
                      Go to main page &rarr;
                    </Link>
                  </HStack>
                  <SbaaTableFilters mb={4} />
                </Box>
                <SbaaTable />
                <SbaaTablePagination />
              </SbaaTableProvider>
            </AccordionPanel>
          </AccordionItem>
        ),
      }
    : {
        Stat: null,
        AccordionItem: null,
      };
};
