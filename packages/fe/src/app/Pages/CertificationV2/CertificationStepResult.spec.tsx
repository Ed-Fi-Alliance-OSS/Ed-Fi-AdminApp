import { render, screen } from '@testing-library/react';
import { CertificationSavedStepRunDto } from '@edanalytics/models';
import { CertificationStepResult } from './CertificationStepResult';

const failedRun: CertificationSavedStepRunDto = {
  stepId: 189,
  status: 'failed',
  ranAt: '2026-10-15T15:00:00.000Z',
  inputs: { schoolId: '255901' },
  errors: [
    { property: 'res.status', validation: 'eq 200', error: 'expected 500 to equal 200' },
    {
      property: 'calendarCode',
      validation: 'isString',
      error: 'expected undefined to be a string',
    },
  ],
};

describe('CertificationStepResult', () => {
  it('prompts to execute when the step has no result', () => {
    render(<CertificationStepResult run={undefined} isRunning={false} />);

    expect(screen.getByText('Not executed')).toBeTruthy();
    expect(screen.getByText('Execute this step to see its result.')).toBeTruthy();
  });

  it('shows Running while the step runs, even over a saved failure', () => {
    render(<CertificationStepResult run={failedRun} isRunning />);

    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('Running this step. This can take up to a minute.')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.queryByText(/expected 500 to equal 200/)).toBeNull();
  });

  it('shows a successful run with its time and no errors', () => {
    render(
      <CertificationStepResult
        run={{ ...failedRun, status: 'success', errors: [] }}
        isRunning={false}
      />,
    );

    expect(screen.getByText('Successful')).toBeTruthy();
    expect(screen.getByText(/^Last execution: /)).toBeTruthy();
    expect(screen.queryByText(/^Errors:/)).toBeNull();
  });

  it('shows a failed run with every error', () => {
    render(<CertificationStepResult run={failedRun} isRunning={false} />);

    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Errors: 2')).toBeTruthy();
    expect(screen.getByText('Property: res.status')).toBeTruthy();
    expect(screen.getByText('Validation: eq 200')).toBeTruthy();
    expect(screen.getByText('Error: expected 500 to equal 200')).toBeTruthy();
    expect(screen.getByText('Property: calendarCode')).toBeTruthy();
    expect(screen.getByText('Error: expected undefined to be a string')).toBeTruthy();
  });

  it('shows the raw time when it cannot be parsed', () => {
    render(
      <CertificationStepResult run={{ ...failedRun, ranAt: 'not a date' }} isRunning={false} />,
    );

    expect(screen.getByText('Last execution: not a date')).toBeTruthy();
  });
});
