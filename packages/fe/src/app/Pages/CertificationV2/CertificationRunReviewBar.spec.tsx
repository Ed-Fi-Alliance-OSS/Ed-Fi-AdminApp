import 'reflect-metadata';
import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ComponentProps } from 'react';
import { useCanSeeCertification } from '../MyProducts/useCanSeeCertification';
import { CertificationRunReviewBar } from './CertificationRunReviewBar';
import { useSendCertificationRunToReview } from './useSendCertificationRunToReview';

// The package index pulls in react-router (ESM); only the real confirmation dialog is needed.
jest.mock('@edanalytics/common-ui', () =>
  jest.requireActual('../../../../../common-ui/src/lib/confirmAction'),
);
jest.mock('../MyProducts/useCanSeeCertification', () => ({ useCanSeeCertification: jest.fn() }));
jest.mock('./useSendCertificationRunToReview', () => ({
  useSendCertificationRunToReview: jest.fn(),
}));

const NOTE = 'Every scenario must succeed before you can send the run to review.';
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
    (useCanSeeCertification as jest.Mock).mockReturnValue({ canSee: true, canRun: true });
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

  it('disables it while the scenario statuses are unknown', () => {
    render(bar({ isStatusUnknown: true }));
    expect(sendButton().disabled).toBe(true);
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

  it('hides it from users who may not run certification', () => {
    (useCanSeeCertification as jest.Mock).mockReturnValue({ canSee: true, canRun: false });
    render(bar());
    expect(screen.queryByRole('button', { name: 'Send to Review' })).toBeNull();
    expect(screen.getByText('3 of 3 scenarios successful')).toBeTruthy();
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
