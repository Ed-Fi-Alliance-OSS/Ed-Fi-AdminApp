import 'reflect-metadata';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CertificationReviewDto, CertReviewDecision } from '@edanalytics/models';
import { authorize, usePrivilegeCacheForConfig } from '../../helpers';
import { useCertificationStepSnapshot } from '../CertificationV2/useCertificationStepSnapshot';
import { CertificationReviewPage } from './CertificationReviewPage';
import { reviewSnapshotSource, useCertificationReview } from './useCertificationReview';

const mockNavigate = jest.fn();
let mockParams: { runId?: string } = { runId: '7' };
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

const mockRemoveQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ removeQueries: mockRemoveQueries }),
}));

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

jest.mock('../../helpers', () => ({
  authorize: jest.fn(),
  usePrivilegeCacheForConfig: jest.fn(),
  useNavContext: jest.fn(),
}));

const mockSource = { url: jest.fn(), queryKey: jest.fn() };
jest.mock('./useCertificationReview', () => ({
  useCertificationReview: jest.fn(),
  reviewSnapshotSource: jest.fn(() => mockSource),
  certificationReviewQueryKeys: { review: (runId: number) => ['certification', 'review', runId] },
}));

jest.mock('../CertificationV2/useCertificationRun', () => ({
  toRunId: (value: string | undefined) => Number(value) || undefined,
}));

jest.mock('../CertificationV2/useCertificationStepSnapshot', () => ({
  useCertificationStepSnapshot: jest.fn(),
}));

// The modal has its own spec; here it only shows which decision is open and reports one.
jest.mock('./CertificationReviewDecisionModal', () => ({
  CertificationReviewDecisionModal: ({
    runId,
    decision,
    onDecided,
  }: {
    runId: number;
    decision: CertReviewDecision | null;
    onDecided: (decision: CertReviewDecision) => void;
  }) =>
    decision ? (
      <div data-testid="decision-modal" data-run={runId} data-decision={decision}>
        <button type="button" onClick={() => onDecided(decision)}>
          Confirm decision
        </button>
      </div>
    ) : null,
}));

const mockAuthorize = authorize as jest.Mock;
const mockCache = usePrivilegeCacheForConfig as jest.Mock;
const mockReview = useCertificationReview as jest.Mock;
const mockSnapshot = useCertificationStepSnapshot as jest.Mock;

const review = (
  run: Partial<CertificationReviewDto['run']> = {},
  scenarios?: CertificationReviewDto['scenarios'],
): CertificationReviewDto => ({
  run: {
    runId: 7,
    teamName: 'Team A',
    environmentName: 'Env 1',
    tenantName: 'tenant1',
    dataStoreName: 'Ods One',
    certificationModel: 'SIS',
    status: 'IN_REVIEW',
    submittedAt: '2026-11-12T10:00:00.000Z',
    dataStandardVersion: '5.2.0',
    canDecide: true,
    ...run,
  },
  scenarios: scenarios ?? [
    {
      scenarioId: 1,
      domainName: 'Enrollment',
      name: 'Enroll a student',
      status: 'completed',
      steps: [
        {
          stepId: 5,
          name: 'Create the student',
          result: {
            stepId: 5,
            status: 'failed',
            ranAt: '2026-11-11T09:00:00.000Z',
            inputs: {},
            responseStatus: 404,
            errors: [
              { kind: 'exception', field: null, expected: null, observed: null, message: 'Boom' },
            ],
          },
        },
        { stepId: 6, name: 'Never ran', result: null },
      ],
    },
    { scenarioId: 2, domainName: 'Staff', name: 'Hire a teacher', status: null, steps: [] },
  ],
});

const setup = (
  data: CertificationReviewDto | undefined,
  { canReview = true, cacheLoading = false, error = null as unknown } = {},
) => {
  mockCache.mockReturnValue([{ isLoading: cacheLoading }]);
  mockAuthorize.mockReturnValue(canReview);
  mockReview.mockReturnValue({ data, error, isLoading: data === undefined && !error });
};

const quiet = (fn: () => void) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

const fact = (label: string) =>
  within(screen.getByRole('group', { name: 'Certification run' }))
    .getByText(label)
    .closest('div')?.textContent;

// The accordion panel animates open, so its steps appear asynchronously.
const openStep = async (scenario: RegExp, step: string) => {
  fireEvent.click(screen.getByRole('button', { name: scenario }));
  fireEvent.click(await screen.findByRole('button', { name: step }));
};

describe('CertificationReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { runId: '7' };
    mockSnapshot.mockReturnValue({ snapshot: undefined, isPending: false, isError: false });
  });

  it('shows a spinner while the privilege cache loads', () => {
    setup(undefined, { canReview: false, cacheLoading: true });
    render(<CertificationReviewPage />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('throws "Not allowed" without certification:review', () => {
    setup(review(), { canReview: false });
    quiet(() => expect(() => render(<CertificationReviewPage />)).toThrow('Not allowed'));
    expect(mockCache).toHaveBeenCalledWith({
      privilege: 'certification:review',
      subject: { id: '__filtered__' },
    });
    expect(mockReview).toHaveBeenCalledWith(7, false);
  });

  it('rethrows a failed privilege cache request', () => {
    setup(undefined, { canReview: false });
    mockCache.mockReturnValue([{ isLoading: false, error: new Error('Auth cache failed') }]);
    quiet(() => expect(() => render(<CertificationReviewPage />)).toThrow('Auth cache failed'));
  });

  it('rethrows a failed review request', () => {
    setup(undefined, { error: new Error('Request failed with status code 404') });
    quiet(() =>
      expect(() => render(<CertificationReviewPage />)).toThrow(
        'Request failed with status code 404',
      ),
    );
  });

  it('shows a spinner while the review loads', () => {
    setup(undefined);
    render(<CertificationReviewPage />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders the title and the header fields', () => {
    setup(review());
    render(<CertificationReviewPage />);

    expect(screen.getByRole('heading', { name: 'Review certification run' })).toBeTruthy();
    expect(fact('Team')).toContain('Team A');
    expect(fact('Environment / Tenant')).toContain('Env 1 / tenant1');
    expect(fact('Data store')).toContain('Ods One');
    expect(fact('Certification Model')).toContain('SIS');
    expect(fact('Status')).toContain('In review');
    expect(fact('Sent')).toContain(new Date('2026-11-12T10:00:00.000Z').toLocaleString());
  });

  it('shows "—" for a run without a team, a data store or a sent date', () => {
    setup(review({ teamName: null, dataStoreName: null, submittedAt: null }));
    render(<CertificationReviewPage />);

    expect(fact('Team')).toBe('Team—');
    expect(fact('Data store')).toBe('Data store—');
    expect(fact('Sent')).toBe('Sent—');
  });

  it('has no Run button and no credentials form', async () => {
    setup(review());
    render(<CertificationReviewPage />);
    await openStep(/Enroll a student/, 'Create the student');

    expect(screen.queryByRole('button', { name: /^(Run|Execute)/ })).toBeNull();
    expect(screen.queryByText(/Client ID|Client secret|Authenticate/i)).toBeNull();
  });

  it('groups the scenarios by domain with their status', () => {
    setup(review());
    render(<CertificationReviewPage />);

    expect(screen.getByRole('heading', { name: 'Enrollment' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeTruthy();
    const enroll = screen.getByRole('button', { name: /Enroll a student/ });
    expect(within(enroll).getByText('Successful')).toBeTruthy();
    const hire = screen.getByRole('button', { name: /Hire a teacher/ });
    expect(within(hire).getByText('Not executed')).toBeTruthy();
  });

  it('says so when the run has no scenarios', () => {
    setup(review({}, []));
    render(<CertificationReviewPage />);
    expect(screen.getByText('This run has no scenarios to show.')).toBeTruthy();
  });

  it('shows the selected step result and the snapshot panel read through the review source', async () => {
    setup(review());
    render(<CertificationReviewPage />);
    await openStep(/Enroll a student/, 'Create the student');

    expect(screen.getByText('Execution result')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
    expect(reviewSnapshotSource).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole('button', { name: /View response details/ }));
    expect(mockSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: mockSource, stepId: 5, enabled: true }),
    );
  });

  it('shows a step that never ran as not executed', async () => {
    setup(review());
    render(<CertificationReviewPage />);
    await openStep(/Enroll a student/, 'Never ran');

    expect(screen.getByText('Execute this step to see its result.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /View response details/ })).toBeNull();
  });

  it('shows "couldn\'t be loaded" when the snapshot request fails, and keeps working', async () => {
    setup(review());
    mockSnapshot.mockReturnValue({ snapshot: undefined, isPending: false, isError: true });
    render(<CertificationReviewPage />);
    await openStep(/Enroll a student/, 'Create the student');
    fireEvent.click(screen.getByRole('button', { name: /View response details/ }));

    expect(screen.getByText("The response couldn't be loaded.")).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Review certification run' })).toBeTruthy();
  });

  it('shows Approve, Reject and Request changes when the run can be decided', () => {
    setup(review());
    render(<CertificationReviewPage />);

    for (const [name, decision] of [
      ['Approve', 'APPROVED'],
      ['Reject', 'REJECTED'],
      ['Request changes', 'CHANGES_REQUESTED'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(screen.getByTestId('decision-modal').dataset).toMatchObject({ run: '7', decision });
    }
  });

  it.each(['APPROVED', 'REJECTED'] as const)('shows no decision buttons for %s', (status) => {
    setup(review({ status, canDecide: false }));
    render(<CertificationReviewPage />);

    for (const name of ['Approve', 'Reject', 'Request changes']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it.each(['APPROVED', 'REJECTED'] as const)('stays on the page after %s', (decision) => {
    setup(review());
    render(<CertificationReviewPage />);
    fireEvent.click(
      screen.getByRole('button', { name: decision === 'APPROVED' ? 'Approve' : 'Reject' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockRemoveQueries).not.toHaveBeenCalled();
    expect(screen.queryByTestId('decision-modal')).toBeNull();
  });

  it('goes to the dashboard after Request changes, then drops the review query', () => {
    setup(review());
    render(<CertificationReviewPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));

    expect(mockNavigate).toHaveBeenCalledWith('/certification/dashboard');
    expect(mockRemoveQueries).toHaveBeenCalledWith({
      queryKey: ['certification', 'review', 7],
    });
    expect(mockNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      mockRemoveQueries.mock.invocationCallOrder[0],
    );
    expect(screen.getByRole('heading', { name: 'Review certification run' })).toBeTruthy();
  });

  it('says the run was not found for an address without a valid run ID', () => {
    mockParams = { runId: 'abc' };
    setup(undefined);
    render(<CertificationReviewPage />);
    expect(screen.getByText("This certification run wasn't found.")).toBeTruthy();
  });
});
