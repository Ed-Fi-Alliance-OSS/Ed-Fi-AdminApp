jest.mock('../../helpers', () => ({
  useTeamEdfiTenantNavContextLoaded: jest.fn(),
}));

import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { createVersionedResource } from './versioned';

const mockUseNavContext = useTeamEdfiTenantNavContextLoaded as jest.Mock;

const setVersion = (version: 'v1' | 'v2' | 'v3' | undefined) => {
  mockUseNavContext.mockReturnValue({ edfiTenant: { sbEnvironment: { version } } });
};

describe('createVersionedResource', () => {
  afterEach(() => jest.clearAllMocks());

  const useResource = createVersionedResource({ v2: 'v2-resource', v3: 'v3-resource' });

  it('returns the v2 resource when the tenant is on v2', () => {
    setVersion('v2');
    expect(useResource()).toBe('v2-resource');
  });

  it('returns the v3 resource when the tenant is on v3', () => {
    setVersion('v3');
    expect(useResource()).toBe('v3-resource');
  });

  it('throws when the resolved version has no mapped resource', () => {
    setVersion('v1');
    expect(() => useResource()).toThrow('No resource registered for admin API version "v1"');
  });

  it('throws when version is undefined', () => {
    setVersion(undefined);
    expect(() => useResource()).toThrow('No resource registered for admin API version "undefined"');
  });
});
