import 'reflect-metadata';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CertReviewDecision } from '@edanalytics/models';
import { Component, ReactNode } from 'react';
import { apiClient } from '../../api-v2/apiClient';
import { CertificationReviewPage } from './CertificationReviewPage';
import { certificationReviewQueryKeys } from './useCertificationReview';

// A real QueryClient: after Request changes, the page must not refetch its now-unreadable run.

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ runId: '7' }),
}));
jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: ReactNode; children?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
jest.mock('../../helpers', () => ({
  authorize: () => true,
  usePrivilegeCacheForConfig: () => [{ isLoading: false }],
  useNavContext: jest.fn(),
}));
jest.mock('../../api', () => ({ methods: {} }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../CertificationV2/useCertificationRun', () => ({
  toRunId: (value: string | undefined) => Number(value) || undefined,
}));
// The modal has its own spec; here it only reports the decision as saved.
jest.mock('./CertificationReviewDecisionModal', () => ({
  CertificationReviewDecisionModal: ({
    decision,
    onDecided,
  }: {
    decision: CertReviewDecision | null;
    onDecided: (decision: CertReviewDecision) => void;
  }) =>
    decision ? (
      <button type="button" onClick={() => onDecided(decision)}>
        Confirm decision
      </button>
    ) : null,
}));

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? (
      <p>Error boundary: {this.state.error.message}</p>
    ) : (
      this.props.children
    );
  }
}

const mockGet = apiClient.get as jest.Mock;

const review = {
  run: {
    runId: 7,
    teamName: 'Team A',
    environmentName: 'Env 1',
    tenantName: 'tenant1',
    dataStoreName: 'Ods One',
    certificationModel: 'SIS',
    status: 'IN_REVIEW',
    submittedAt: null,
    dataStandardVersion: '5.2.0',
    canDecide: true,
  },
  scenarios: [],
};

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('CertificationReviewPage after Request changes', () => {
  it('goes to the dashboard without refetching the run, and drops it once the page is gone', async () => {
    // The run is readable once; after Request changes the API answers 404.
    mockGet
      .mockResolvedValueOnce(review)
      .mockRejectedValue({ statusCode: 404, message: 'Not Found' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <Boundary>
          <CertificationReviewPage />
        </Boundary>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Request changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/certification/dashboard'));
    await flush();
    await flush();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Error boundary/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Review certification run' })).toBeTruthy();

    unmount();
    expect(
      queryClient.getQueryCache().find({ queryKey: certificationReviewQueryKeys.review(7) }),
    ).toBeUndefined();
    spy.mockRestore();
  });
});
