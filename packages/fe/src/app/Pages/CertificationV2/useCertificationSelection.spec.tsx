import { renderHook } from '@testing-library/react';
import { useCertificationSelection } from './useCertificationSelection';

// react-router is ESM-only under jest, so stand in a minimal useSearchParams.
let mockSearch = '';
jest.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}));

const renderSelection = (search: string) => {
  mockSearch = search;
  return renderHook(() => useCertificationSelection());
};

describe('useCertificationSelection', () => {
  it('reads a positive integer scenario ID from the query string', () => {
    expect(renderSelection('scenarioId=3').result.current.scenarioId).toBe(3);
  });

  it.each(['abc', '0', '-1', '1.5', ''])('treats "%s" as unset', (value) => {
    expect(renderSelection(`scenarioId=${value}`).result.current.scenarioId).toBeUndefined();
  });

  it('ignores the tenant and data store, which now come from the run', () => {
    const { result } = renderSelection('edfiTenantId=10&odsId=5&scenarioId=3');
    expect(result.current).toEqual({ scenarioId: 3, toSearch: expect.any(Function) });
    expect(result.current.toSearch()).toBe('?scenarioId=3');
  });

  it('toSearch lets the caller choose the scenario', () => {
    const { result } = renderSelection('scenarioId=3');
    expect(result.current.toSearch({ scenarioId: 9 })).toBe('?scenarioId=9');
  });

  it('toSearch is empty when no scenario is chosen', () => {
    expect(renderSelection('').result.current.toSearch()).toBe('');
  });
});
