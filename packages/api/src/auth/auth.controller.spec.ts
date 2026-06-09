import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController, LOCAL_ONLY_LOGOUT_MESSAGE } from './auth.controller';

jest.mock('config', () => ({
  FE_URL: 'http://frontend',
  MY_URL_API_PATH: 'http://adminapp/api',
  USE_PKCE: false,
}));

describe('AuthController logout', () => {
  let controller: AuthController;
  let getEndSessionUrl: jest.Mock;
  let response: Response;

  const buildRequest = (session: Record<string, unknown>): Request => {
    return {
      headers: {},
      session: {
        destroy: jest.fn((callback: (err?: Error) => void) => callback()),
        ...session,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  };

  beforeEach(() => {
    getEndSessionUrl = jest.fn();
    controller = new AuthController(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { getEndSessionUrl } as any,
    );
    response = {
      redirect: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('rejects Bearer token authentication', async () => {
    const request = buildRequest({});
    request.headers['authorization'] = 'Bearer some-token';

    await expect(controller.logout(request, response)).rejects.toThrow(BadRequestException);
  });

  it('redirects to the end-session URL of the provider the user logged in with', async () => {
    const request = buildRequest({ oidcId: 3, idToken: 'the-id-token' });
    getEndSessionUrl.mockReturnValue('http://idp/end-session?id_token_hint=the-id-token');

    await controller.logout(request, response);

    expect(request.session.destroy).toHaveBeenCalled();
    expect(getEndSessionUrl).toHaveBeenCalledWith(3, 'the-id-token');
    expect(response.redirect).toHaveBeenCalledWith(
      'http://idp/end-session?id_token_hint=the-id-token',
    );
  });

  it('falls back to a local-only logout with a message when the provider has no end_session_endpoint', async () => {
    const request = buildRequest({ oidcId: 2, idToken: 'the-id-token' });
    getEndSessionUrl.mockReturnValue(null);

    await controller.logout(request, response);

    expect(request.session.destroy).toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      `http://frontend/unauthenticated?msg=${encodeURIComponent(LOCAL_ONLY_LOGOUT_MESSAGE)}`,
    );
  });

  it('redirects to the frontend when the session has no login provider tracked', async () => {
    const request = buildRequest({});

    await controller.logout(request, response);

    expect(request.session.destroy).toHaveBeenCalled();
    expect(getEndSessionUrl).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith('http://frontend');
  });

  it('redirects to the frontend when destroying the session fails', async () => {
    const request = buildRequest({ oidcId: 1, idToken: 'the-id-token' });
    (request.session.destroy as jest.Mock).mockImplementation((callback: (err?: Error) => void) =>
      callback(new Error('session store unavailable')),
    );

    await controller.logout(request, response);

    expect(getEndSessionUrl).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith('http://frontend');
  });
});
