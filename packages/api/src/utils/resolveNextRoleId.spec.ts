import { resolveNextRoleId } from './resolveNextRoleId';

describe('resolveNextRoleId', () => {
  it('returns the body roleId when the field is present', () => {
    expect(resolveNextRoleId({ roleId: 4 }, 3)).toBe(4);
  });

  it('returns an explicit null from the body (unassign)', () => {
    expect(resolveNextRoleId({ roleId: null }, 3)).toBeNull();
  });

  it('returns the current roleId when the body omits the field', () => {
    expect(resolveNextRoleId({}, 3)).toBe(3);
  });

  it('ignores an inherited roleId, matching applyDtoUpdates', () => {
    const dto = Object.create({ roleId: 9 });
    expect(resolveNextRoleId(dto, 3)).toBe(3);
  });
});
