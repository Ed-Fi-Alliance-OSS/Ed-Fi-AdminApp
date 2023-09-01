import {
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react';
import { DataTable } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { odsQueries } from '../../api';
import {
  AuthorizeConfig,
  authorize,
  useNavContext,
  usePrivilegeCacheForConfig,
} from '../../helpers';
import { NameCell } from '../Ods/NameCell';

export const useOdsContent = (props: { sbe: GetSbeDto }) => {
  const asId = useNavContext().asId!;
  const odsAuth: AuthorizeConfig = {
    privilege: 'tenant.sbe.ods:read',
    subject: {
      id: '__filtered__',
      sbeId: props.sbe.id,
      tenantId: Number(asId),
    },
  };
  const odss = odsQueries.useAll({ optional: true, tenantId: asId, sbeId: props.sbe.id });
  usePrivilegeCacheForConfig(odsAuth);
  const queryClient = useQueryClient();

  return authorize({ queryClient, config: odsAuth })
    ? {
        Stat: (
          <Stat flex="0 0 auto">
            <StatLabel>ODS's</StatLabel>
            <StatNumber>{Object.keys(odss.data ?? {}).length}</StatNumber>
          </Stat>
        ),
        AccordionItem: (
          <AccordionItem>
            <AccordionButton>
              <Heading fontWeight="medium" fontSize="md" as="span" flex="1" textAlign="left">
                ODS's
              </Heading>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={10}>
              <DataTable
                queryKeyPrefix={`${props.sbe.id}_ods`}
                pageSizes={[5, 10, 15]}
                data={Object.values(odss?.data || {})}
                columns={[
                  {
                    accessorKey: 'displayName',
                    cell: NameCell,
                    header: 'Name',
                  },
                  {
                    accessorKey: 'createdDetailed',
                    header: 'Created',
                  },
                ]}
              />
            </AccordionPanel>
          </AccordionItem>
        ),
      }
    : {
        Stat: null,
        AccordionItem: null,
      };
};
