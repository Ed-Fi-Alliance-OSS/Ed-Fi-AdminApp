import 'reflect-metadata';
import { ChakraProvider } from '@chakra-ui/react';
import { CERT_NOT_ALL_SCENARIOS_COMPLETED } from '@edanalytics/models';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ComponentProps } from 'react';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import { CertificationRunReviewBar } from './CertificationRunReviewBar';
import { useSendCertificationRunToReview } from './useSendCertificationRunToReview';

// The package index pulls in react-router (ESM); only the real confirmation dialog is needed.
jest.mock('@edanalytics/common-ui', () =>
  jest.requireActual('../../../../../common-ui/src/lib/confirmAction'),
);
jest.mock('../../api', () => ({ methods: {} }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: {} }));
jest.mock('../MyProducts/useCanSeeCertification', () => ({ useCanSeeCertification: jest.fn() }));
jest.mock('./useSendCertificationRunToReview', () => ({
  useSendCertificationRunToReview: jest.fn(),
}));
const mockPopBanner = jest.fn();
jest.mock('../../Layout/FeedbackBanner', () => ({ usePopBanner: () => mockPopBanner }));

const NOTE = CERT_NOT_ALL_SCENARIOS_COMPLETED;
const NO_PERMISSION = "You don't have permission to send runs to review.";
const allCompleted = { 1: 'completed', 2: 'completed', 3: 'completed' } as const;
type BarProps = ComponentProps<typeof CertificationRunReviewBar>;
const baseProps: BarProps = {
  teamId: 2,
  edfiTenantId: 10,
  runId: 7,
  status: 'DRAFT',
  scenarioIds: [1, 2, 3],
  statusByScenarioId: allCompleted,
  isStatusUnknown: false,
};

describe('CertificationRunReviewBar', () => {
  let mutateAsync: jest.Mock;
  let mutation: { mutateAsync: jest.Mock; isPending: boolean; error: unknown };

  const bar = (props: Partial<BarProps> = {}) => (
    <ChakraProvider>
      <CertificationRunReviewBar {...baseProps} {...props} />
    </ChakraProvider>
  );
  const sendButton = () =>
    screen.getByRole('button', { name: 'Send to Review' }) as HTMLButtonElement;

  beforeEach(() => {
    jest.clearAllMocks();
    mutateAsync = jest.fn().mockResolvedValue({ runId: 7, status: 'READY_FOR_REVIEW' });
    mutation = { mutateAsync, isPending: false, error: null };
    (useSendCertificationRunToReview as jest.Mock).mockImplementation(() => mutation);
    (useCanSeeCertification as jest.Mock).mockReturnValue({
      canSee: true,
      canRun: true,
      isLoading: false,
      error: null,
    });
  });

  it('shows the status and how many scenarios succeeded', () => {
    render(bar({ statusByScenarioId: { 1: 'completed', 2: 'failed' } }));
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('1 of 3 scenarios successful')).toBeTruthy();
  });

  it.each(['DRAFT', 'CHANGES_REQUESTED'] as const)(
    'enables Send to Review for a %s run whose scenarios all succeeded',
    (status) => {
      render(bar({ status }));
      expect(sendButton().disabled).toBe(false);
      expect(screen.queryByText(NOTE)).toBeNull();
    },
  );

  it.each([
    ['failed', { ...allCompleted, 2: 'failed' }],
    ['in progress', { ...allCompleted, 2: 'inprogress' }],
    ['never run', { 1: 'completed', 3: 'completed' }],
  ] as const)('disables it with the note while a scenario is %s', (_label, statuses) => {
    render(bar({ statusByScenarioId: statuses }));
    expect(sendButton().disabled).toBe(true);
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('disables it again when a scenario fails after all had succeeded', () => {
    const { rerender } = render(bar());
    expect(sendButton().disabled).toBe(false);
    rerender(bar({ statusByScenarioId: { ...allCompleted, 3: 'failed' } }));
    expect(sendButton().disabled).toBe(true);
  });

  it('disables it and shows no count while the scenario statuses are unknown', () => {
    render(bar({ isStatusUnknown: true }));
    expect(sendButton().disabled).toBe(true);
    expect(screen.getByText('Loading scenario results…')).toBeTruthy();
    expect(screen.queryByText(/scenarios successful/)).toBeNull();
  });

  it('disables it when the run has no scenarios', () => {
    render(bar({ scenarioIds: [], statusByScenarioId: {} }));
    expect(sendButton().disabled).toBe(true);
  });

  it.each(['READY_FOR_REVIEW', 'IN_REVIEW', 'READY_FOR_REVIEW_WITH_CHANGES', 'APPROVED'] as const)(
    'disables it without the note for a %s run',
    (status) => {
      render(bar({ status }));
      expect(sendButton().disabled).toBe(true);
      expect(screen.queryByText(NOTE)).toBeNull();
    },
  );

  it('hides it from users who may not run certification, and says why', () => {
    (useCanSeeCertification as jest.Mock).mockReturnValue({
      canSee: true,
      canRun: false,
      isLoading: false,
      error: null,
    });
    render(bar());
    expect(screen.queryByRole('button', { name: 'Send to Review' })).toBeNull();
    expect(screen.getByText('3 of 3 scenarios successful')).toBeTruthy();
    expect(screen.getByText(NO_PERMISSION)).toBeTruthy();
  });

  it.each([
    ['loading', { isLoading: true, error: null }],
    ['failed', { isLoading: false, error: new Error('Network Error') }],
  ])("doesn't claim a missing permission while the permission check is %s", (_label, state) => {
    (useCanSeeCertification as jest.Mock).mockReturnValue({
      canSee: false,
      canRun: false,
      ...state,
    });
    render(bar());
    expect(screen.queryByText(NO_PERMISSION)).toBeNull();
  });

  it.each([
    [
      'READY_FOR_REVIEW',
      "This run was sent to review. Steps can't be executed unless reviewers request changes.",
    ],
    [
      'READY_FOR_REVIEW_WITH_CHANGES',
      "This run was sent to review. Steps can't be executed unless reviewers request changes.",
    ],
    [
      'IN_REVIEW',
      "Reviewers are checking this run. Steps can't be executed unless they request changes.",
    ],
    ['APPROVED', "This run was approved. Steps can't be executed."],
    ['REJECTED', "This run was rejected. Steps can't be executed."],
  ] as const)('explains why a %s run is locked', (status, note) => {
    render(bar({ status }));
    expect(screen.getByText(note)).toBeTruthy();
  });

  it.each(['DRAFT', 'CHANGES_REQUESTED'] as const)('has no lock note for a %s run', (status) => {
    render(bar({ status }));
    expect(screen.queryByText(/Steps can't be executed/)).toBeNull();
  });

  it('sends the run only after the vendor confirms', async () => {
    render(bar());
    fireEvent.click(sendButton());
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ teamId: 2, edfiTenantId: 10, runId: 7 }),
    );
  });

  it('tells the vendor who checks the run before they confirm', async () => {
    render(bar());
    fireEvent.click(sendButton());
    expect(
      await screen.findByText(
        "Reviewers will check your results. You won't be able to execute steps again unless they request changes.",
      ),
    ).toBeTruthy();
  });

  it('confirms the run was sent', async () => {
    render(bar());
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mockPopBanner).toHaveBeenCalledWith({
        type: 'Success',
        title: 'Run sent to review',
        message: "It's locked until the reviewers respond.",
      }),
    );
  });

  it("doesn't confirm a refused send", async () => {
    mutateAsync.mockRejectedValue({ message: 'refused' });
    render(bar());
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mockPopBanner).not.toHaveBeenCalled();
  });

  it("shows the confirmation's Send button as busy while the run is being sent", async () => {
    const { rerender } = render(bar());
    fireEvent.click(sendButton());
    await screen.findByRole('button', { name: 'Send' });

    mutation.isPending = true;
    rerender(bar());

    // While busy, the spinner replaces the button's accessible name.
    const confirm = screen.getByText('Send').closest('button') as HTMLButtonElement;
    expect(confirm.hasAttribute('data-loading')).toBe(true);
  });

  it('sends once when Send is clicked again while the first send is still running', async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    render(bar());
    fireEvent.click(sendButton());
    const confirm = await screen.findByRole('button', { name: 'Send' });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });

  it('drops a refusal once the run is no longer sendable, e.g. sent from another tab', () => {
    mutation.error = { message: "This certification run can't move to that status." };
    render(bar({ status: 'READY_FOR_REVIEW' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("shows a fallback when the refusal doesn't say why", () => {
    mutation.error = {};
    render(bar());
    expect(screen.getByRole('alert').textContent).toContain(
      "The run couldn't be sent to review. Try again.",
    );
  });

  it('shows why the server refused to send the run', () => {
    mutation.error = {
      message: 'Every scenario must succeed before the run can be sent to review.',
    };
    render(bar());
    expect(screen.getByRole('alert').textContent).toContain(
      'Every scenario must succeed before the run can be sent to review.',
    );
  });
});
