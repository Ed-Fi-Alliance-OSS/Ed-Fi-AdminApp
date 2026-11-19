import { Box, SimpleGrid, Stat, StatLabel, StatNumber } from '@chakra-ui/react';
import { CertificationTeamDashboardCountsDto } from '@edanalytics/models';

const CARDS: { label: string; key: keyof CertificationTeamDashboardCountsDto }[] = [
  { label: 'Submissions waiting on us', key: 'waitingOnUs' },
  { label: 'Ready for Ed-Fi review', key: 'readyForReview' },
  { label: 'Runs executing now', key: 'executingNow' },
  { label: 'Certified', key: 'certified' },
];

/** The four count cards. `null` (nothing to count yet) shows them grayed out at 0. */
export const TeamDashboardSummaryCards = ({
  counts,
}: {
  counts: CertificationTeamDashboardCountsDto | null;
}) => (
  <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
    {CARDS.map(({ label, key }) => (
      <Box
        key={key}
        data-testid="summary-card"
        data-placeholder={counts ? undefined : 'true'}
        borderWidth="1px"
        borderRadius="md"
        p={4}
        bg={counts ? undefined : 'gray.50'}
        color={counts ? undefined : 'gray.600'}
      >
        <Stat>
          <StatLabel>{label}</StatLabel>
          <StatNumber>{counts ? counts[key] : 0}</StatNumber>
        </Stat>
      </Box>
    ))}
  </SimpleGrid>
);
