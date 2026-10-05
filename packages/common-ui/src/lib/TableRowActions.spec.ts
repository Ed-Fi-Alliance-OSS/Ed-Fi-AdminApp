import { ActionProps, ActionsType } from './ActionsType';
import { splitActions } from './TableRowActions';

// `splitActions` is pure; stub the rendering helpers TableRowActions.tsx also
// imports (getStandardActions pulls in react-router, which common-ui's jest
// setup can't resolve).
jest.mock('./getStandardActions', () => ({}));
jest.mock('./Icons', () => ({ Icons: {} }));

const action = (overrides: Partial<ActionProps> = {}): ActionProps =>
  ({ onClick: jest.fn(), icon: () => null, text: 'x', title: 'x', ...overrides }) as ActionProps;

const build = (regular: string[], extra: Record<string, Partial<ActionProps>> = {}) =>
  Object.fromEntries([
    ...regular.map((key) => [key, action()]),
    ...Object.entries(extra).map(([key, overrides]) => [key, action(overrides)]),
  ]) as ActionsType;

const keys = (entries: Array<[string, unknown]>) => entries.map(([key]) => key);

describe('splitActions', () => {
  describe('default target (show undefined)', () => {
    it('shows all four actions when there are exactly four', () => {
      const { visible, hidden } = splitActions(build(['a', 'b', 'c', 'd']));
      expect(keys(visible)).toEqual(['a', 'b', 'c', 'd']);
      expect(hidden).toEqual([]);
    });

    it('shows three and overflows the rest when there are five or more', () => {
      const { visible, hidden } = splitActions(build(['a', 'b', 'c', 'd', 'e']));
      expect(keys(visible)).toEqual(['a', 'b', 'c']);
      expect(keys(hidden)).toEqual(['d', 'e']);
    });

    it('overflows irrelevant actions first', () => {
      const { visible, hidden } = splitActions(
        build(['a', 'b', 'c', 'd'], { irrelevant: { isIrrelevant: true } })
      );
      expect(keys(visible)).toEqual(['a', 'b', 'c']);
      expect(keys(hidden)).toEqual(['d', 'irrelevant']);
    });
  });

  describe('overflowOnly actions', () => {
    it('do not count toward the inline target, so four regular actions stay inline', () => {
      const { visible, hidden } = splitActions(
        build(['a', 'b', 'c', 'd'], { pinned: { overflowOnly: true } })
      );
      expect(keys(visible)).toEqual(['a', 'b', 'c', 'd']);
      expect(keys(hidden)).toEqual(['pinned']);
    });

    it('leave the regular split unchanged and go last in the menu', () => {
      const { visible, hidden } = splitActions(
        build(['a', 'b', 'c', 'd', 'e'], {
          pinned: { overflowOnly: true },
          irrelevant: { isIrrelevant: true },
        })
      );
      expect(keys(visible)).toEqual(['a', 'b', 'c']);
      expect(keys(hidden)).toEqual(['d', 'e', 'irrelevant', 'pinned']);
    });

    it('stay in the menu with a custom target', () => {
      const { visible, hidden } = splitActions(
        build(['a', 'b', 'c'], { pinned: { overflowOnly: true } }),
        2
      );
      expect(keys(visible)).toEqual(['a', 'b']);
      expect(keys(hidden)).toEqual(['c', 'pinned']);
    });

    it('are shown inline when every action is requested (show === true)', () => {
      const { visible, hidden } = splitActions(
        build(['a', 'b'], { pinned: { overflowOnly: true } }),
        true
      );
      expect(keys(visible)).toEqual(['a', 'b', 'pinned']);
      expect(hidden).toEqual([]);
    });
  });
});
