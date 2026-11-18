import 'reflect-metadata';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CertificationReviewDto } from '@edanalytics/models';
import { useCertificationStepSnapshot } from '../CertificationV2/useCertificationStepSnapshot';
import { CertificationReviewStepsPage } from './CertificationReviewStepsPage';
import { ReviewRun, useReviewRun } from './useReviewRun';

const mockNavigate = jest.fn();
let mockSearch = 'scenarioId=1';
jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}));

jest.mock('@edanalytics/common-ui', () => ({
  PageTemplate: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// paths.ts only needs useNavContext from the helpers barrel, which pulls in ESM-only modules.
jest.mock('../../helpers', () => ({ useNavContext: jest.fn() }));

jest.mock('./useReviewRun', () => ({ useReviewRun: jest.fn() }));

jest.mock('../CertificationV2/useCertificationStepSnapshot', () => ({
  useCertificationStepSnapshot: jest.fn(),
}));

const mockReviewRun = useReviewRun as jest.Mock;
const mockSnapshot = useCertificationStepSnapshot as jest.Mock;
const mockSource = { url: jest.fn(), queryKey: jest.fn() };

const data: CertificationReviewDto = {
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
  },
  scenarios: [
    {
      scenarioId: 1,
      domainName: 'Enrollment',
      name: 'Enroll a student',
      status: 'failed',
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
        {
          stepId: 6,
          name: 'Read the student',
          result: {
            stepId: 6,
            status: 'success',
            ranAt: '2026-11-11T09:05:00.000Z',
            inputs: {},
            responseStatus: 200,
            errors: [],
          },
        },
        { stepId: 8, name: 'Never ran', result: null },
      ],
    },
    { scenarioId: 2, domainName: 'Staff', name: 'Hire a teacher', status: null, steps: [] },
  ],
};

const ready = (overrides: Partial<Extract<ReviewRun, { state: 'ready' }>> = {}): ReviewRun => ({
  state: 'ready',
  runId: 7,
  data,
  isUnavailable: false,
  snapshotSource: mockSource,
  ...overrides,
});

const stepRow = (name: string) =>
  within(screen.getByRole('table', { name: 'Steps' }))
    .getByText(name)
    .closest('tr') as HTMLElement;

const openStep = (name: string) =>
  fireEvent.click(within(stepRow(name)).getByRole('button', { name: 'Open' }));

describe('CertificationReviewStepsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = 'scenarioId=1';
    mockReviewRun.mockReturnValue(ready());
    mockSnapshot.mockReturnValue({ snapshot: undefined, isPending: false, isError: false });
  });

  it('shows a spinner while the run loads', () => {
    mockReviewRun.mockReturnValue({ state: 'loading' });
    render(<CertificationReviewStepsPage />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('lets the run guard throw "Not allowed"', () => {
    mockReviewRun.mockImplementation(() => {
      throw new Error('Not allowed');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CertificationReviewStepsPage />)).toThrow('Not allowed');
    spy.mockRestore();
  });

  it('shows the run header and the domain and scenario banner', () => {
    render(<CertificationReviewStepsPage />);
    expect(screen.getByRole('heading', { name: 'Review certification run' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Certification run' })).toBeTruthy();
    const banner = screen.getByRole('group', { name: 'Scenario' });
    expect(within(banner).getByText('Enrollment')).toBeTruthy();
    expect(within(banner).getByText('Enroll a student')).toBeTruthy();
  });

  it('lists the steps with Passed, Failed and Not executed, never Successful', () => {
    render(<CertificationReviewStepsPage />);
    const table = screen.getByRole('table', { name: 'Steps' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Step', 'Status', 'Action']);
    expect(within(stepRow('Create the student')).getByText('Failed')).toBeTruthy();
    expect(within(stepRow('Read the student')).getByText('Passed')).toBeTruthy();
    expect(within(stepRow('Never ran')).getByText('Not executed')).toBeTruthy();
    expect(screen.queryByText('Successful')).toBeNull();
  });

  it('asks to open a step until one is opened', () => {
    render(<CertificationReviewStepsPage />);
    expect(screen.getByText('Select Open on a row to see its result.')).toBeTruthy();
    expect(screen.queryByText('Execution result')).toBeNull();
  });

  it('shows the opened step result and its snapshot through the review source', () => {
    render(<CertificationReviewStepsPage />);
    openStep('Create the student');

    expect(screen.getByText('Execution result')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
    expect(screen.queryByText('Select Open on a row to see its result.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /View response details/ }));
    expect(mockSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: mockSource, stepId: 5, enabled: true }),
    );
  });

  it('says a never-run step was not run', () => {
    render(<CertificationReviewStepsPage />);
    openStep('Never ran');
    expect(screen.getByText("This step wasn't run.")).toBeTruthy();
    expect(screen.queryByText('Execute this step to see its result.')).toBeNull();
  });

  it('offers no way to run a step or decide the run', () => {
    render(<CertificationReviewStepsPage />);
    openStep('Create the student');
    for (const name of [/^(Run|Execute)/, 'Approve', 'Reject', 'Request changes']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByText(/Client ID|Client secret|Authenticate/i)).toBeNull();
  });

  it('goes back to the scenarios page', () => {
    render(<CertificationReviewStepsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/certification/runs/7/review');
  });

  it('says so when the scenario has no steps', () => {
    mockSearch = 'scenarioId=2';
    render(<CertificationReviewStepsPage />);
    expect(screen.getByText('No steps found for this scenario.')).toBeTruthy();
  });

  it.each(['scenarioId=abc', '', 'scenarioId=99', 'scenarioId=0'])(
    'says the scenario was not found for "%s", with Back',
    (search) => {
      mockSearch = search;
      render(<CertificationReviewStepsPage />);
      expect(screen.getByText("This scenario wasn't found.")).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(mockNavigate).toHaveBeenCalledWith('/certification/runs/7/review');
    },
  );

  it('says the run was not found for an address without a valid run ID', () => {
    mockReviewRun.mockReturnValue({ state: 'notFound' });
    render(<CertificationReviewStepsPage />);
    expect(screen.getByText("This certification run wasn't found.")).toBeTruthy();
  });

  it('warns when the run is no longer available, and keeps the steps readable', () => {
    mockReviewRun.mockReturnValue(ready({ isUnavailable: true }));
    render(<CertificationReviewStepsPage />);
    expect(screen.getByText('This run is no longer available for review.')).toBeTruthy();
    expect(stepRow('Create the student')).toBeTruthy();
  });
});
