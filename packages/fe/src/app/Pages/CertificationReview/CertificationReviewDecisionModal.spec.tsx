import 'reflect-metadata';
import { ChakraProvider } from '@chakra-ui/react';
import { CertReviewDecision } from '@edanalytics/models';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CertificationReviewDecisionModal } from './CertificationReviewDecisionModal';
import { useCertificationReviewDecision } from './useCertificationReview';

jest.mock('../../api-v2/apiClient', () => ({ apiClient: {} }));
jest.mock('./useCertificationReview', () => ({ useCertificationReviewDecision: jest.fn() }));
const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));

const VARIANTS = [
  ['APPROVED', 'Approve this run?', 'Comment (optional)', 'Approve', 'Run approved'],
  ['REJECTED', 'Reject this run?', 'Reason', 'Reject', 'Run rejected'],
  [
    'CHANGES_REQUESTED',
    'Request changes?',
    'What needs to change',
    'Request changes',
    'Changes requested',
  ],
] as const;

describe('CertificationReviewDecisionModal', () => {
  let mutateAsync: jest.Mock;
  let mutation: { mutateAsync: jest.Mock; isPending: boolean };
  const onClose = jest.fn();
  const onDecided = jest.fn();

  const modal = (decision: CertReviewDecision | null) => (
    <ChakraProvider>
      <CertificationReviewDecisionModal
        runId={7}
        decision={decision}
        onClose={onClose}
        onDecided={onDecided}
      />
    </ChakraProvider>
  );
  const confirm = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  beforeEach(() => {
    jest.clearAllMocks();
    mutateAsync = jest.fn().mockResolvedValue({});
    mutation = { mutateAsync, isPending: false };
    (useCertificationReviewDecision as jest.Mock).mockImplementation(() => mutation);
  });

  it('renders nothing without a decision', () => {
    render(modal(null));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(VARIANTS)('shows the %s copy', (decision, title, label, button) => {
    render(modal(decision));
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(confirm(button)).toBeTruthy();
    expect(screen.getByText('0 / 4000')).toBeTruthy();
  });

  it.each([VARIANTS[1], VARIANTS[2]])(
    'keeps %s confirm disabled until a reason is typed',
    (decision, _t, label, button) => {
      render(modal(decision));
      expect(confirm(button).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '   ' } });
      expect(confirm(button).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'why' } });
      expect(confirm(button).disabled).toBe(false);
    },
  );

  it('enables Approve without a comment and sends no comment', async () => {
    render(modal('APPROVED'));
    expect(confirm('Approve').disabled).toBe(false);
    fireEvent.click(confirm('Approve'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        runId: 7,
        decision: 'APPROVED',
        comment: undefined,
      }),
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Run approved' }));
    expect(onDecided).toHaveBeenCalledWith('APPROVED');
  });

  it('posts the trimmed comment and calls onDecided', async () => {
    render(modal('REJECTED'));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '  bad data  ' } });
    fireEvent.click(confirm('Reject'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        runId: 7,
        decision: 'REJECTED',
        comment: 'bad data',
      }),
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Run rejected' }));
    expect(onDecided).toHaveBeenCalledWith('REJECTED');
  });

  it('toasts and closes on a 409', async () => {
    mutateAsync.mockRejectedValue({ statusCode: 409, message: 'x' });
    render(modal('APPROVED'));
    fireEvent.click(confirm('Approve'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'This run changed. Refreshing.' }),
    );
    expect(onDecided).not.toHaveBeenCalled();
  });

  it('shows other errors inline and stays open', async () => {
    mutateAsync.mockRejectedValue({ statusCode: 400, message: ['comment is too long'] });
    render(modal('REJECTED'));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'x' } });
    fireEvent.click(confirm('Reject'));
    expect((await screen.findByRole('alert')).textContent).toContain('comment is too long');
    expect(onClose).not.toHaveBeenCalled();
    expect(onDecided).not.toHaveBeenCalled();
  });

  it('Cancel closes without posting', () => {
    render(modal('APPROVED'));
    fireEvent.click(confirm('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
