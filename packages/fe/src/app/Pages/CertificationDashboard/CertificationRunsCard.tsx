import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { ContentSection, PageContentCard } from '@edanalytics/common-ui';
import {
  CertificationDashboardListDto,
  CertificationDashboardRunDto,
  CERT_RUN_STATUS_LABELS,
} from '@edanalytics/models';
import { ReactNode } from 'react';
import { formatWaiting } from './formatWaiting';

const EMPTY = '—';

export type CertificationRunsTimeColumn = 'Waiting' | 'Last updated';

/** A titled card listing certification runs, with a "Waiting" or "Last updated" time column. */
export const CertificationRunsCard = ({
  title,
  list,
  timeColumn,
  emptyMessage,
  renderAction,
}: {
  title: string;
  list: CertificationDashboardListDto;
  timeColumn: CertificationRunsTimeColumn;
  emptyMessage?: string;
  /** When given, adds an "Action" column rendering this per row. */
  renderAction?: (row: CertificationDashboardRunDto) => ReactNode;
}) => (
  <PageContentCard>
    <ContentSection heading={title}>
      {list.total === 0 && emptyMessage && <Text color="gray.600">{emptyMessage}</Text>}
      {list.rows.length > 0 && (
        <TableContainer>
          <Table size="sm" aria-label={title}>
            <Thead>
              <Tr>
                <Th>Team</Th>
                <Th>Data store</Th>
                <Th>Certification Model</Th>
                <Th>Status</Th>
                <Th>{timeColumn}</Th>
                {renderAction && <Th>Action</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {list.rows.map((row) => (
                <CertificationRunRow
                  key={row.runId}
                  row={row}
                  timeColumn={timeColumn}
                  renderAction={renderAction}
                />
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      {list.total > list.rows.length && (
        <Text color="gray.600" fontSize="sm" mt={2}>
          Showing {list.rows.length} of {list.total}
        </Text>
      )}
    </ContentSection>
  </PageContentCard>
);

export const CertificationRunRow = ({
  row,
  timeColumn,
  renderAction,
}: {
  row: CertificationDashboardRunDto;
  timeColumn: CertificationRunsTimeColumn;
  renderAction?: (row: CertificationDashboardRunDto) => ReactNode;
}) => (
  <Tr>
    <Td>{row.teamName ?? EMPTY}</Td>
    <Td>{row.dataStore ?? `${row.sbEnvironmentName} / ${row.edfiTenantName}`}</Td>
    <Td>{row.certificationModel}</Td>
    <Td>{CERT_RUN_STATUS_LABELS[row.status]}</Td>
    <Td>
      {timeColumn === 'Waiting'
        ? formatWaiting(row.submittedAt ?? row.statusChangedAt)
        : new Date(row.updatedAt).toLocaleString()}
    </Td>
    {renderAction && <Td>{renderAction(row)}</Td>}
  </Tr>
);
