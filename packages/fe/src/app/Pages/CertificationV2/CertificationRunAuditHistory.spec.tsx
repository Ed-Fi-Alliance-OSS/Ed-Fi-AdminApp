import 'reflect-metadata';
import { ChakraProvider } from '@chakra-ui/react';
import { CertificationRunEventDto } from '@edanalytics/models';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CertificationRunAuditHistory } from './CertificationRunAuditHistory';
import { useCertificationRunEvents } from './useCertificationRunEvents';

jest.mock('../../api', () => ({ methods: {} }));
jest.mock('./useCertificationRunEvents', () => ({ useCertificationRunEvents: jest.fn() }));

const CREATED_AT = '2026-11-20T15:30:00.000Z';
const DATE = new Date(CREATED_AT).toLocaleString(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const entry = (over: Partial<CertificationRunEventDto>): CertificationRunEventDto => ({
  eventId: 1,
  event: 'CREATED',
  fromStatus: null,
  toStatus: 'DRAFT',
  createdAt: CREATED_AT,
  actorName: 'Ann Vendor',
  comment: null,
  ...over,
});

const loadMore = jest.fn();
const renderCard = (state: Partial<ReturnType<typeof useCertificationRunEvents>> = {}) => {
  (useCertificationRunEvents as jest.Mock).mockReturnValue({
    events: [],
    hasMore: false,
    loadMore,
    isLoadingMore: false,
    isLoading: false,
    isError: false,
    ...state,
  });
  return render(
    <ChakraProvider>
      <CertificationRunAuditHistory teamId={2} runId={7} />
    </ChakraProvider>,
  );
};

describe('CertificationRunAuditHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an "Audit history" heading and its entries', () => {
    renderCard({
      events: [
        entry({}),
        entry({
          eventId: 2,
          event: 'CHANGES_REQUESTED',
          fromStatus: 'IN_REVIEW',
          toStatus: 'CHANGES_REQUESTED',
          actorName: 'Rita Reviewer',
          comment: 'Please fix step 2',
        }),
      ],
    });

    expect(screen.getByRole('heading', { level: 2, name: /Audit history/ })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain(DATE);
    expect(items[0].textContent).toContain('Run started');
    expect(items[0].textContent).toContain('Draft');
    expect(items[0].textContent).toContain('Ann Vendor');
    expect(items[1].textContent).toContain('Changes requested');
    expect(items[1].textContent).toContain('Rita Reviewer');
    expect(items[1].textContent).toContain('Please fix step 2');
    expect(screen.getAllByText(DATE)[0].getAttribute('datetime')).toBe(CREATED_AT);
  });

  it('collapses and expands', async () => {
    renderCard({ events: [entry({})] });
    const toggle = screen.getByRole('button', { name: /Audit history/ });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(screen.queryByRole('list')).toBeNull());
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('list')).toBeTruthy();
  });

  it('shows "Show more" only while there are more entries', () => {
    const { unmount } = renderCard({ events: [entry({})], hasMore: false });
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    unmount();

    renderCard({ events: [entry({})], hasMore: true });
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('shows an empty message with no entries', () => {
    renderCard();

    expect(screen.getByText('No history yet.')).toBeTruthy();
  });

  it('shows an error message when the read fails', () => {
    renderCard({ isError: true });

    expect(screen.getByText("The audit history couldn't be loaded.")).toBeTruthy();
    expect(screen.queryByText('No history yet.')).toBeNull();
  });

  it('has no edit or delete controls', () => {
    renderCard({ events: [entry({})], hasMore: true });

    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('Audit history');
    expect(names[1]).toBe('Show more');
  });
});
