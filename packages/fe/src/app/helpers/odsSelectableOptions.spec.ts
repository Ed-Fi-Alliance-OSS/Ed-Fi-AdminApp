import { buildOdsSelectOptions, isOdsAvailable } from './odsSelectableOptions';

const ods = (id: number, status: string | null, displayName = `ods-${id}`) => ({
  id,
  odsInstanceId: id * 10,
  status,
  displayName,
});

describe('isOdsAvailable', () => {
  it('treats Created as available', () => {
    expect(isOdsAvailable({ status: 'Created' })).toBe(true);
  });

  it('treats a null status as available', () => {
    expect(isOdsAvailable({ status: null })).toBe(true);
  });

  it.each(['PendingCreate', 'PendingDelete', 'Error'])('treats %s as unavailable', (status) => {
    expect(isOdsAvailable({ status })).toBe(false);
  });
});

describe('buildOdsSelectOptions', () => {
  const byId = (o: ReturnType<typeof ods>) => o.id;
  const byInstanceId = (o: ReturnType<typeof ods>) => o.odsInstanceId;

  it('includes Created and null-status rows and excludes pending rows', () => {
    const options = buildOdsSelectOptions(
      [ods(1, 'Created'), ods(2, null), ods(3, 'PendingCreate'), ods(4, 'PendingDelete')],
      byId,
      undefined,
    );
    expect(options).toEqual({
      1: { value: 1, label: 'ods-1' },
      2: { value: 2, label: 'ods-2' },
    });
  });

  it('keeps the selected row when it is unavailable and labels it with its status', () => {
    const options = buildOdsSelectOptions(
      [ods(1, 'Created'), ods(4, 'PendingDelete'), ods(5, 'PendingDelete')],
      byId,
      4,
    );
    expect(options).toEqual({
      1: { value: 1, label: 'ods-1' },
      4: { value: 4, label: 'ods-4 (PendingDelete)' },
    });
  });

  it('does not add a status suffix to a selected available row', () => {
    const options = buildOdsSelectOptions([ods(1, 'Created')], byId, 1);
    expect(options).toEqual({ 1: { value: 1, label: 'ods-1' } });
  });

  it('matches the selected value using the same key as the option values', () => {
    const options = buildOdsSelectOptions(
      [ods(1, 'Created'), ods(4, 'PendingDelete')],
      byInstanceId,
      40,
    );
    expect(options).toEqual({
      10: { value: 10, label: 'ods-1' },
      40: { value: 40, label: 'ods-4 (PendingDelete)' },
    });
  });

  it('matches a selected value of a different primitive type (string vs number)', () => {
    const options = buildOdsSelectOptions([ods(4, 'PendingDelete')], byId, '4');
    expect(options).toEqual({ 4: { value: 4, label: 'ods-4 (PendingDelete)' } });
  });
});
