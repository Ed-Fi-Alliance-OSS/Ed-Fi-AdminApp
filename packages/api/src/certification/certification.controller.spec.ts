import { ServiceUnavailableException } from '@nestjs/common';
import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationController } from './certification.controller';

describe('CertificationController', () => {
  const sbEnvironment = { id: 1 } as never;
  const edfiTenant = { id: 10, name: 'tenant1' } as never;
  const body = { odsId: 5, token: 't', inputs: { studentUniqueId: 'S1' } };

  it('passes the route, tenant and body to the service and serializes the result', async () => {
    const service = {
      runStep: jest.fn().mockResolvedValue({
        stepId: 101,
        status: 'success',
        ranAt: '2026-10-12T20:00:00.000Z',
        scenarioStatus: 'inprogress',
        errors: [],
      }),
    };
    const controller = new CertificationController(service as never);
    const res = { setHeader: jest.fn() };

    const result = await controller.runStep(sbEnvironment, edfiTenant, 'v5', 101, body, res as never);

    expect(service.runStep).toHaveBeenCalledWith({
      sbEnvironment,
      edfiTenant,
      sisVersion: 'v5',
      stepId: 101,
      odsId: 5,
      token: 't',
      inputs: { studentUniqueId: 'S1' },
    });
    expect(result).toEqual({
      stepId: 101,
      status: 'success',
      ranAt: '2026-10-12T20:00:00.000Z',
      scenarioStatus: 'inprogress',
      errors: [],
    });
  });

  it('adds Retry-After when the service is temporarily unavailable', async () => {
    const service = { runStep: jest.fn().mockRejectedValue(new ServiceUnavailableException('busy')) };
    const controller = new CertificationController(service as never);
    const res = { setHeader: jest.fn() };

    await expect(controller.runStep(sbEnvironment, edfiTenant, 'v5', 101, body, res as never)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });

  it('is guarded by sb-environment:update on the environment', () => {
    expect(Reflect.getMetadata(AUTHORIZE_KEY, CertificationController.prototype.runStep)).toEqual({
      privilege: 'sb-environment:update',
      subject: { id: 'sbEnvironmentId' },
    });
  });
});
