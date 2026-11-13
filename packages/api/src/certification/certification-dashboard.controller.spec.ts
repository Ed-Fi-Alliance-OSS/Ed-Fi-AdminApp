import { AUTHORIZE_KEY } from '../auth/authorization/authorize.decorator';
import { CertificationDashboardController } from './certification-dashboard.controller';

describe('CertificationDashboardController', () => {
  it('delegates to the service and returns its result', async () => {
    const dashboard = {
      counts: { newlyReadyForReview: 1, readyWithNewChanges: 0, pickedUp: 0, runsInFlight: 2 },
      waiting: { rows: [], total: 0 },
      others: { rows: [], total: 0 },
    };
    const service = { getDashboard: jest.fn().mockResolvedValue(dashboard) };
    const controller = new CertificationDashboardController(service as never);

    await expect(controller.getDashboard()).resolves.toEqual(dashboard);
    expect(service.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('is guarded by certification:read', () => {
    expect(
      Reflect.getMetadata(AUTHORIZE_KEY, CertificationDashboardController.prototype.getDashboard),
    ).toEqual({ privilege: 'certification:read', subject: { id: '__filtered__' } });
  });

  it('serves GET certification/dashboard', () => {
    expect(Reflect.getMetadata('path', CertificationDashboardController)).toBe(
      'certification/dashboard',
    );
    expect(
      Reflect.getMetadata('path', CertificationDashboardController.prototype.getDashboard),
    ).toBe('/');
    expect(
      Reflect.getMetadata('method', CertificationDashboardController.prototype.getDashboard),
    ).toBe(0); // RequestMethod.GET
  });
});
