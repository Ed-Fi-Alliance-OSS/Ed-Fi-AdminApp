import 'reflect-metadata';
import { useQuery } from '@tanstack/react-query';
import { sbEnvironmentQueries } from '../api';
import { useIsStartingBlocksDeployment } from './useIsStartingBlocksDeployment';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../api', () => ({
  sbEnvironmentQueries: {
    getAll: jest.fn(() => ({ queryKey: ['sb-environments'] })),
  },
}));

const mockUseQuery = useQuery as jest.Mock;

describe('useIsStartingBlocksDeployment', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the deployment\'s environment has startingBlocks: false', () => {
    mockUseQuery.mockReturnValue({
      data: { 1: { id: 1, startingBlocks: false } },
    });

    expect(useIsStartingBlocksDeployment()).toBe(false);
  });

  it('returns true when the deployment\'s environment has startingBlocks: true', () => {
    mockUseQuery.mockReturnValue({
      data: { 1: { id: 1, startingBlocks: true } },
    });

    expect(useIsStartingBlocksDeployment()).toBe(true);
    expect(sbEnvironmentQueries.getAll).toHaveBeenCalledWith({});
  });

  it('defaults to true while environments are still loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined });

    expect(useIsStartingBlocksDeployment()).toBe(true);
  });
});
