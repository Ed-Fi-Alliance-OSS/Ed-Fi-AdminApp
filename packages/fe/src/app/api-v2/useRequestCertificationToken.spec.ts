import { useMutation } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import {
  certificationTokenErrorMessage,
  useRequestCertificationToken,
} from './useRequestCertificationToken';

jest.mock('./apiClient', () => ({ apiClient: { post: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ useMutation: jest.fn() }));

describe('useRequestCertificationToken', () => {
  it('does not keep the submitted credentials in the mutation cache', () => {
    useRequestCertificationToken();
    expect((useMutation as jest.Mock).mock.calls[0][0]).toMatchObject({ gcTime: 0 });
  });

  it("posts the credentials to the team's tenant", async () => {
    useRequestCertificationToken();
    const { mutationFn } = (useMutation as jest.Mock).mock.calls.at(-1)[0];
    const body = { key: 'k', secret: 's', odsId: 5 };

    await mutationFn({ teamId: 2, edfiTenantId: 10, body });

    expect(apiClient.post).toHaveBeenCalledWith(
      'teams/2/edfi-tenants/10/certification/token',
      body,
    );
  });
});

describe('certificationTokenErrorMessage', () => {
  it('returns the server message', () => {
    expect(
      certificationTokenErrorMessage({
        data: { errors: { 'root.serverError': { message: 'X' } } },
      }),
    ).toBe('X');
  });

  it.each([
    ['empty errors', { data: { errors: {} } }],
    ['undefined', undefined],
    ['a string', 'boom'],
  ])('falls back for %s', (_label, error) => {
    expect(certificationTokenErrorMessage(error)).toBe('Authentication failed. Try again.');
  });
});
