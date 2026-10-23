import 'reflect-metadata';
import { fireEvent, render, screen } from '@testing-library/react';
import { CertificationSavedStepRunDto, CertificationStepSnapshotDto } from '@edanalytics/models';
import { CertificationStepResult } from './CertificationStepResult';
import { useCertificationStepSnapshot } from './useCertificationStepSnapshot';

jest.mock('./useCertificationStepSnapshot', () => ({ useCertificationStepSnapshot: jest.fn() }));

const snapshotArgs = { sbEnvironmentId: 1, edfiTenantId: 10, odsId: 5, sisVersion: 'v5' };

const fieldsRun: CertificationSavedStepRunDto = {
  stepId: 189,
  status: 'failed',
  ranAt: '2026-10-15T15:00:00.000Z',
  inputs: { studentUniqueId: 'S1' },
  responseStatus: 200,
  errors: [
    {
      kind: 'assertion',
      field: 'birthCity',
      expected: 'Not empty',
      observed: 'Empty text',
      message: "expected '' not to be empty",
    },
    {
      kind: 'assertion',
      field: 'middleName',
      expected: 'Text, not empty',
      observed: null,
      message: 'expected undefined to be a string',
    },
  ],
};

const exceptionRun: CertificationSavedStepRunDto = {
  ...fieldsRun,
  responseStatus: 404,
  errors: [
    {
      kind: 'exception',
      field: null,
      expected: null,
      observed: 'The API returned HTTP 404 Not Found.',
      message:
        'No Student found, or multiple records were returned. Check your parameters and try again.',
    },
  ],
};

const mockSnapshot = (snapshot?: CertificationStepSnapshotDto) =>
  (useCertificationStepSnapshot as jest.Mock).mockReturnValue({
    snapshot,
    isPending: false,
    isError: false,
  });

const renderResult = (run: CertificationSavedStepRunDto | undefined, isRunning = false) =>
  render(<CertificationStepResult run={run} isRunning={isRunning} snapshotArgs={snapshotArgs} />);

const openPanel = () =>
  fireEvent.click(screen.getByRole('button', { name: /Response from the API/ }));

const lastHookArgs = () => (useCertificationStepSnapshot as jest.Mock).mock.calls.at(-1)[0];

describe('CertificationStepResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshot();
  });

  it('prompts to execute when the step has no result', () => {
    renderResult(undefined);

    expect(screen.getByText('Not executed')).toBeTruthy();
    expect(screen.getByText('Execute this step to see its result.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Response from the API/ })).toBeNull();
  });

  it('shows Running while the step runs, even over a saved failure', () => {
    renderResult(exceptionRun, true);

    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('Running this step. This can take up to a minute.')).toBeTruthy();
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.queryByText(/No Student found/)).toBeNull();
  });

  it('shows only the exception and what the API returned when the step stopped', () => {
    renderResult(exceptionRun);

    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText(/^No Student found, or multiple records/)).toBeTruthy();
    expect(screen.getByText('The API returned HTTP 404 Not Found.')).toBeTruthy();
    expect(screen.queryByText(/fields? didn't match/)).toBeNull();
  });

  it('shows one row per field with what was expected and observed', () => {
    renderResult(fieldsRun);

    expect(screen.getByText("2 fields didn't match")).toBeTruthy();
    for (const header of ['Field', 'Expected', 'Observed']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
    const row = screen.getByRole('row', { name: /middleName/ });
    expect(row.textContent).toContain('Text, not empty');
    expect(row.textContent).toContain('—');
    expect(screen.getByRole('row', { name: /birthCity/ }).textContent).toContain('Empty text');
  });

  it("shows Bruno's message when a check has neither an expected nor an observed value", () => {
    renderResult({
      ...fieldsRun,
      errors: [
        {
          kind: 'assertion',
          field: 'enrollment count',
          expected: null,
          observed: null,
          message: 'expected 0 to be above 1',
        },
      ],
    });

    const row = screen.getByRole('row', { name: /enrollment count/ });
    expect(row.textContent).toContain('expected 0 to be above 1');
    expect(row.textContent).not.toContain('—');
  });

  it("says '1 field' for a single row", () => {
    renderResult({ ...fieldsRun, errors: [fieldsRun.errors[0]] });

    expect(screen.getByText("1 field didn't match")).toBeTruthy();
  });

  it('shows the HTTP status pill coloured by the step result, not the status code', () => {
    const { unmount } = renderResult(exceptionRun);
    expect(screen.getByText('HTTP 404 Not Found').getAttribute('data-status')).toBe('failed');
    unmount();

    renderResult({ ...exceptionRun, status: 'success', errors: [] });
    expect(screen.getByText('HTTP 404 Not Found').getAttribute('data-status')).toBe('success');
  });

  it('shows the number alone for a status without a known reason phrase', () => {
    renderResult({ ...exceptionRun, responseStatus: 418 });

    expect(screen.getByText('HTTP 418')).toBeTruthy();
  });

  it('shows no pill when the request was never sent', () => {
    renderResult({ ...exceptionRun, responseStatus: null });

    expect(screen.queryByText(/^HTTP /)).toBeNull();
  });

  it('shows a successful run with its time and no errors', () => {
    renderResult({ ...fieldsRun, status: 'success', errors: [] });

    expect(screen.getByText('Successful')).toBeTruthy();
    expect(screen.getByText(/^Last execution: /)).toBeTruthy();
    expect(screen.queryByText(/didn't match/)).toBeNull();
  });

  it('no longer shows the raw Bruno labels', () => {
    renderResult(fieldsRun);

    expect(screen.queryByText(/Validation errors:/)).toBeNull();
    expect(screen.queryByText(/^Property:/)).toBeNull();
  });

  it('shows the raw time when it cannot be parsed', () => {
    renderResult({ ...fieldsRun, ranAt: 'not a date' });

    expect(screen.getByText('Last execution: not a date')).toBeTruthy();
  });

  describe('response panel', () => {
    it('is collapsed and loads nothing until opened', () => {
      renderResult(fieldsRun);

      expect(lastHookArgs()).toMatchObject({ enabled: false, stepId: 189, ranAt: fieldsRun.ranAt });
      expect(
        screen.queryByText(
          'This snapshot is deleted when the certification request is approved or rejected.',
        ),
      ).toBeNull();
    });

    it('loads the snapshot when opened and shows the disclaimer', () => {
      renderResult(fieldsRun);
      openPanel();

      expect(lastHookArgs()).toMatchObject({ ...snapshotArgs, enabled: true, stepId: 189 });
      expect(
        screen.getByText(
          'This snapshot is deleted when the certification request is approved or rejected.',
        ),
      ).toBeTruthy();
    });

    it('shows the stored body', () => {
      mockSnapshot({ state: 'body', body: '[\n  {\n    "id": "abc123"\n  }\n]' });
      renderResult(fieldsRun);
      openPanel();

      expect(screen.getByText(/"id": "abc123"/)).toBeTruthy();
    });

    it.each([
      [
        { state: 'tooLarge', sizeBytes: 81234 },
        'The response is larger than the 64 KB snapshot limit. To review it, call the Ed-Fi API directly.',
      ],
      [{ state: 'none' }, "No response: the request wasn't sent."],
      [
        { state: 'deleted' },
        'The snapshot was deleted when the certification request was decided.',
      ],
    ])('explains a %j snapshot', (snapshot, text) => {
      mockSnapshot(snapshot as CertificationStepSnapshotDto);
      renderResult(fieldsRun);
      openPanel();

      expect(screen.getByText(text)).toBeTruthy();
    });
  });
});
