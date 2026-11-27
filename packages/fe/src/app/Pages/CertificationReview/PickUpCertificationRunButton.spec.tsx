import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PickUpCertificationRunButton } from './PickUpCertificationRunButton';
import { usePickUpCertificationRun } from './useCertificationReview';

jest.mock('./useCertificationReview', () => ({ usePickUpCertificationRun: jest.fn() }));
jest.mock('../../helpers', () => ({ useNavContext: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({ useNavigate: () => mockNavigate }));

const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: () => mockToast,
}));

const mockMutateAsync = jest.fn();

describe('PickUpCertificationRunButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePickUpCertificationRun as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('navigates to the review page after a successful pick-up', async () => {
    mockMutateAsync.mockResolvedValue({ runId: 7, status: 'IN_REVIEW' });
    render(<PickUpCertificationRunButton runId={7} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pick up' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ runId: 7 });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/certification/runs/7/review'));
  });

  it('warns and stays on the page on a 409', async () => {
    mockMutateAsync.mockRejectedValue({ statusCode: 409 });
    render(<PickUpCertificationRunButton runId={7} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pick up' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Someone already picked up this run.',
          status: 'warning',
        }),
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toasts the error message on another failure', async () => {
    mockMutateAsync.mockRejectedValue({ statusCode: 500, message: 'Boom' });
    render(<PickUpCertificationRunButton runId={7} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pick up' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Boom', status: 'error' }),
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error has none', async () => {
    mockMutateAsync.mockRejectedValue(undefined);
    render(<PickUpCertificationRunButton runId={7} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pick up' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not pick up this run.', status: 'error' }),
      ),
    );
  });

  it('is disabled and shows the reason as tooltip when isDisabled', async () => {
    render(<PickUpCertificationRunButton runId={7} isDisabled disabledReason="Already picked up" />);

    const button = screen.getByRole('button', { name: 'Pick up' });
    expect(button).toBeDisabled();
    await userEvent.hover(button.parentElement as HTMLElement);

    expect(await screen.findByText('Already picked up')).toBeInTheDocument();
    await userEvent.click(button);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
