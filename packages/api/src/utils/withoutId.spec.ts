import { withoutId } from './withoutId';

describe('withoutId', () => {
  it('removes an id property', () => {
    const dto = { id: 7, name: 'Team' };

    expect(withoutId(dto)).toEqual({ name: 'Team' });
  });

  it('returns other properties unchanged when there is no id', () => {
    const dto = { teamId: 1, userId: 2 };

    expect(withoutId(dto)).toEqual({ teamId: 1, userId: 2 });
  });

  it('does not mutate the input', () => {
    const dto = { id: 7, name: 'Team' };

    withoutId(dto);

    expect(dto).toEqual({ id: 7, name: 'Team' });
  });
});
