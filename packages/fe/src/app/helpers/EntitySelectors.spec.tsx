import 'reflect-metadata';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useEdfiTenantNavContextLoaded } from './navContext';
import { SelectOds } from './EntitySelectors';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('./navContext', () => ({ useEdfiTenantNavContextLoaded: jest.fn() }));
jest.mock('../api', () => ({ odsQueries: { getAll: jest.fn(() => 'ODS_QUERY') } }));
// EntitySelectors.tsx pulls this in for SelectClaimsetV2, which transitively
// requires an ESM-only module Jest can't load — mocked out the same way other
// EntitySelectors consumers do (e.g. EditApplication.spec.tsx), since this
// suite only exercises SelectOds.
jest.mock('../Pages/ClaimsetV2Plus/claimsetConfig', () => ({ useClaimsetConfig: jest.fn() }));
// Stands in for the real chakra-react-select-backed selector: renders just
// enough of what SelectOds hands it (`options` + the currently selected
// `value`) to assert on the retained/dropped label without needing a real
// dropdown render.
jest.mock('./StandardSelector', () => ({
  SelectWrapper: ({
    options,
    value,
  }: {
    options: Record<string, { label: string }>;
    value?: number | string;
  }) => <div data-testid="selected-label">{value !== undefined && value !== null ? options[value]?.label ?? '' : ''}</div>,
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseNavContext = useEdfiTenantNavContextLoaded as jest.Mock;

describe('SelectOds', () => {
  beforeEach(() => {
    mockUseNavContext.mockReturnValue({ teamId: 1, edfiTenant: { id: 3 } });
  });
  afterEach(() => jest.clearAllMocks());

  it('keeps an unavailable currently-selected ODS visible with its status suffixed onto the label (value/onChange overload, e.g. Edit/Create Application)', () => {
    mockUseQuery.mockReturnValue({
      data: {
        1: { id: 1, status: 'Created', displayName: 'ods-1' },
        4: { id: 4, status: 'PendingDelete', displayName: 'ods-4' },
      },
    });
    render(<SelectOds value={4} onChange={jest.fn()} />);
    expect(screen.getByTestId('selected-label')).toHaveTextContent('ods-4 (PendingDelete)');
  });

  it('does not suffix an available currently-selected ODS (value/onChange overload)', () => {
    mockUseQuery.mockReturnValue({
      data: { 1: { id: 1, status: 'Created', displayName: 'ods-1' } },
    });
    render(<SelectOds value={1} onChange={jest.fn()} />);
    expect(screen.getByTestId('selected-label')).toHaveTextContent('ods-1');
  });

  it('drops an unavailable prefilled ODS entirely for the control/name overload (e.g. Create Ed-Org, Create Ownership) — no selectedValue is threaded through', () => {
    mockUseQuery.mockReturnValue({
      data: { 4: { id: 4, status: 'PendingDelete', displayName: 'ods-4' } },
    });
    render(<SelectOds control={{} as never} name="odsId" />);
    expect(screen.getByTestId('selected-label')).toHaveTextContent('');
  });
});
