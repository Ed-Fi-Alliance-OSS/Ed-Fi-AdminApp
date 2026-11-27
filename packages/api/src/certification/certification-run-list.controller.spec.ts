import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationRunListController } from './certification-run-list.controller';

describe('CertificationRunListController', () => {
  it('delegates to the service and returns its result', async () => {
    const list = { rows: [], total: 0 };
    const service = { getRuns: jest.fn().mockResolvedValue(list) };
    const controller = new CertificationRunListController(service as never);

    await expect(controller.getRuns()).resolves.toEqual(list);
    expect(service.getRuns).toHaveBeenCalledTimes(1);
  });

  it('is guarded by certification:read', () => {
    expect(
      Reflect.getMetadata(AUTHORIZE_KEY, CertificationRunListController.prototype.getRuns),
    ).toEqual({ privilege: 'certification:read', subject: { id: '__filtered__' } });
  });

  it('serves GET certification/runs', () => {
    expect(Reflect.getMetadata('path', CertificationRunListController)).toBe('certification/runs');
    expect(Reflect.getMetadata('path', CertificationRunListController.prototype.getRuns)).toBe('/');
    expect(Reflect.getMetadata('method', CertificationRunListController.prototype.getRuns)).toBe(0);
  });
});
