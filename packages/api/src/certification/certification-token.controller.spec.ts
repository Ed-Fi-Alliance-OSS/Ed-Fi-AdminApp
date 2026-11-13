import { NotFoundException } from '@nestjs/common';
import { INTERCEPTORS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { SbEnvironmentEdfiTenantInterceptor } from '../app/sb-environment-edfi-tenant.interceptor';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationSupportInterceptor } from './certification-support.interceptor';
import { CertificationTokenController } from './certification-token.controller';

describe('CertificationTokenController', () => {
  const sbEnvironment = { id: 1 } as never;
  const edfiTenant = { id: 10, name: 'tenant1' } as never;
  const body = { key: 'k', secret: 's', odsId: 5 };
  const token = {
    token: 't',
    expiresAt: '2026-10-06T20:30:00.000Z',
    oauthUrl: 'https://h/oauth/token',
    resourceBaseUrl: 'https://h/data/v3',
  };

  it("lives under the team's tenant", () => {
    expect(Reflect.getMetadata(PATH_METADATA, CertificationTokenController)).toBe(
      'teams/:teamId/edfi-tenants/:edfiTenantId/certification',
    );
  });

  it('resolves the environment, then refuses unsupported data models', () => {
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, CertificationTokenController)).toEqual([
      SbEnvironmentEdfiTenantInterceptor,
      CertificationSupportInterceptor,
    ]);
  });

  it('passes the tenant, environment and body to the service and serializes the result', async () => {
    const service = { requestToken: jest.fn().mockResolvedValue(token) };
    const controller = new CertificationTokenController(service as never);

    const result = await controller.requestToken(sbEnvironment, edfiTenant, body, new Set([5]));

    expect(service.requestToken).toHaveBeenCalledWith({
      sbEnvironment,
      edfiTenant,
      odsId: 5,
      key: 'k',
      secret: 's',
    });
    expect(result).toEqual(token);
  });

  it("answers 404 and sends no credentials for a data store outside the user's privilege", async () => {
    const service = { requestToken: jest.fn() };
    const controller = new CertificationTokenController(service as never);

    await expect(
      controller.requestToken(sbEnvironment, edfiTenant, body, new Set([6])),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.requestToken).not.toHaveBeenCalled();
  });

  it("is guarded by certification:run on the team's tenant", () => {
    expect(
      Reflect.getMetadata(AUTHORIZE_KEY, CertificationTokenController.prototype.requestToken),
    ).toEqual({
      privilege: 'team.sb-environment.edfi-tenant.ods.certification:run',
      subject: { id: '__filtered__', edfiTenantId: 'edfiTenantId', teamId: 'teamId' },
    });
  });
});
