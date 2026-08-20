import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ViewApplication } from './ViewApplication';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(() => ({ data: {} })) }));
jest.mock('../../helpers', () => ({ useTeamEdfiTenantNavContextLoaded: jest.fn(() => ({ edfiTenant: {}, teamId: 1 })) }));
jest.mock('../../api', () => ({
  claimsetQueriesV2: { getAll: jest.fn() },
  edorgQueries: { getAll: jest.fn() },
  odsQueries: { getAll: jest.fn() },
  profileQueriesV2: { getAll: jest.fn() },
  vendorQueriesV2: { getAll: jest.fn() },
}));
jest.mock('../../routes', () => ({
  ClaimsetLinkV2: () => null,
  EdorgLink: () => null,
  OdsLink: ({ id }: { id: number }) => <span>ods-{id}</span>,
  ProfileLink: () => null,
  VendorLinkV2: () => null,
}));
jest.mock('@edanalytics/common-ui', () => ({
  Attribute: ({ value }: { value: unknown }) => <span>{String(value)}</span>,
  AttributeContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AttributesGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContentSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ViewApplication', () => {
  it('renders the dataStoreIds prop for a v3 application, not application.odsInstanceIds', () => {
    render(
      <ViewApplication
        application={{
          id: 1,
          applicationName: 'App1',
          vendorId: 1,
          claimSetName: 'CS',
          profileIds: [],
          educationOrganizationIds: [2],
        } as never}
        dataStoreIds={[42]}
      />
    );
    expect(screen.getByText('ods-42')).toBeInTheDocument();
  });
});
