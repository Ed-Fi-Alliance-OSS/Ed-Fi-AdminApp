import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { ContentSection, PageContentCard } from '@edanalytics/common-ui';
import {
  CertificationDashboardListDto,
  CertificationDashboardRunDto,
  CertRunStatus,
} from '@edanalytics/models';
import { formatWaiting } from './formatWaiting';

const EMPTY = '—';

export const STATUS_LABELS: Record<CertRunStatus, string> = {
  DRAFT: 'Draft',
  READY_FOR_REVIEW: 'Ready for review',
  IN_REVIEW: 'In review',
  CHANGES_REQUESTED: 'Changes requested',
  READY_FOR_REVIEW_WITH_CHANGES: 'Ready for review with new changes',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export type CertificationRunsTimeColumn = 'Waiting' | 'Last updated';

/** A titled card listing certification runs, with a "Waiting" or "Last updated" time column. */
export const CertificationRunsCard = ({
  title,
  list,
  timeColumn,
  emptyMessage,
}: {
  title: string;
  list: CertificationDashboardListDto;
  timeColumn: CertificationRunsTimeColumn;
  emptyMessage?: string;
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
              </Tr>
            </Thead>
            <Tbody>
              {list.rows.map((row) => (
                <CertificationRunRow key={row.runId} row={row} timeColumn={timeColumn} />
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
}: {
  row: CertificationDashboardRunDto;
  timeColumn: CertificationRunsTimeColumn;
}) => (
  <Tr>
    <Td>{row.teamName ?? EMPTY}</Td>
    <Td>{row.dataStore ?? `${row.sbEnvironmentName} / ${row.edfiTenantName}`}</Td>
    <Td>{row.certificationModel}</Td>
    <Td>{STATUS_LABELS[row.status]}</Td>
    <Td>
      {timeColumn === 'Waiting'
        ? formatWaiting(row.statusChangedAt)
        : new Date(row.updatedAt).toLocaleString()}
    </Td>
  </Tr>
);
