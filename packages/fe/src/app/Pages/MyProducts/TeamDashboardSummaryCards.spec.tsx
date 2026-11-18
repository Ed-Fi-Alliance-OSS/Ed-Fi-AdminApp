import 'reflect-metadata';
import { render, screen } from '@testing-library/react';
import { TeamDashboardSummaryCards } from './TeamDashboardSummaryCards';

describe('TeamDashboardSummaryCards', () => {
  it('shows the four labels with their counts', () => {
    render(
      <TeamDashboardSummaryCards
        counts={{ waitingOnUs: 3, readyForReview: 4, executingNow: 5, certified: 6 }}
      />
    );
    for (const [label, value] of [
      ['Submissions waiting on us', '3'],
      ['Ready for Ed-Fi review', '4'],
      ['Runs executing now', '5'],
      ['Certified', '6'],
    ]) {
      const card = screen.getByText(label).closest('[data-testid="summary-card"]');
      expect(card?.textContent).toContain(value);
      expect(card?.getAttribute('data-placeholder')).toBeNull();
    }
  });

  it('with null counts shows four grayed cards of 0', () => {
    render(<TeamDashboardSummaryCards counts={null} />);
    const cards = screen.getAllByTestId('summary-card');
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.getAttribute('data-placeholder')).toBe('true');
      expect(card.textContent).toContain('0');
    }
  });
});
