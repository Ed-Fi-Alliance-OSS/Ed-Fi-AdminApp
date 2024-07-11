import { useState } from 'react';
import { Button, Collapse, Flex, Spinner } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { odsQueries } from '../../api';
import { useParams } from 'react-router-dom';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { SbaaTableAllInOne } from '@edanalytics/common-ui';

type OdsRowCountsTable = {
  edfiTenant: any;
  teamId: any;
};

export const OdsRowCountsTable = () => {
  const params = useParams() as { odsId: string };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();

  const [hasQueriedData, setHasQueriedData] = useState(false);

  const { data, isFetching, isFetched, refetch, isRefetching } = useQuery(
    odsQueries.rowCounts(
      {
        edfiTenant,
        teamId,
        enabled: hasQueriedData,
      },
      params
    )
  );
  const hasData = !!data;
  const isLoading = isFetching || isRefetching;

  const getRowCountsData = () => {
    if (!hasQueriedData) {
      setHasQueriedData(true);
      return;
    }
    refetch();
  };

  const refreshText = isRefetching ? 'Refreshing' : 'Refresh';
  const retrieveText = isFetching ? 'Retrieving' : 'Retrieve';
  const buttonVerb = hasQueriedData || hasData ? refreshText : retrieveText;
  const rowCountsData = Object.values(data ?? {});

  return (
    <>
      <Flex alignItems="center" mb={isFetched ? 4 : 0}>
        <Button onClick={getRowCountsData} mr={4} disabled={isLoading}>
          {buttonVerb} row counts
        </Button>
        {isLoading && <Spinner />}
      </Flex>
      <Collapse in={rowCountsData.length > 0} startingHeight={0}>
        <SbaaTableAllInOne
          queryKeyPrefix="odsRowCounts"
          data={rowCountsData}
          columns={[
            {
              accessorFn: (row) => `${row.Schema}.${row.Table}`,
              header: 'Table Name',
            },
            {
              accessorKey: 'RecordCount',
              header: 'Number of Rows',
            },
            {
              accessorKey: 'FirstCreated',
              header: 'Earliest Record',
            },
            {
              accessorKey: 'LastCreated',
              header: 'Newest Record',
            },
            {
              accessorKey: 'LastUpdated',
              header: 'Most Recent Update',
            },
          ]}
        />
      </Collapse>
    </>
  );
};
