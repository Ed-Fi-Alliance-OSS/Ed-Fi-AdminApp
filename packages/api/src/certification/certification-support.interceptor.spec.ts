import 'reflect-metadata';
import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { CertificationSupportInterceptor } from './certification-support.interceptor';

const nextHandler = { handle: jest.fn().mockReturnValue('handled') } as unknown as CallHandler;

// SbEnvironmentEdfiTenantInterceptor runs first and leaves the environment on the request.
const contextFor = (sbEnvironment: { odsDsVersion: string | undefined } | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ sbEnvironment }) }),
  }) as unknown as ExecutionContext;

const refusal = (odsDsVersion: string | undefined) => {
  try {
    new CertificationSupportInterceptor().intercept(contextFor({ odsDsVersion }), nextHandler);
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('Expected the request to be refused');
};

describe('CertificationSupportInterceptor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a request through for an environment on Ed-Fi Data Model 5.0.0 or later', () => {
    const result = new CertificationSupportInterceptor().intercept(
      contextFor({ odsDsVersion: '5.2.0' }),
      nextHandler,
    );

    expect(result).toBe('handled');
  });

  it('refuses an environment on Ed-Fi Data Model 4.0.0 with a 400 that names its version', () => {
    const error = refusal('4.0.0');

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({
      type: 'Error',
      title: 'Certification is not available for this environment.',
      message:
        "Certification requires Ed-Fi Data Standard 5.0.0 or later. Admin App has this environment's data standard version as 4.0.0. If its Ed-Fi API has been upgraded since the environment was connected, connect the environment again so Admin App picks up the new version.",
    });
    expect(nextHandler.handle).not.toHaveBeenCalled();
  });

  it('refuses an environment whose data model is unknown', () => {
    const error = refusal(undefined);

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      message:
        "Certification requires Ed-Fi Data Standard 5.0.0 or later. Admin App couldn't read this environment's data standard version from its Ed-Fi API. Check the environment's Ed-Fi API Discovery URL, then connect the environment again.",
    });
    expect(nextHandler.handle).not.toHaveBeenCalled();
  });

  it('leaves a request with no resolved environment to the route pipes (a non-numeric ID gets 400, not 500)', () => {
    // Interceptors run before pipes, and the resolver skips non-numeric IDs.
    const result = new CertificationSupportInterceptor().intercept(
      contextFor(undefined),
      nextHandler,
    );

    expect(result).toBe('handled');
  });
});
