import 'reflect-metadata';
import { AUTHORIZE_KEY } from '../../../auth/authorization/authorize.decorator';
import { OdssController } from './odss.controller';

describe('OdssController job endpoints', () => {
  const subject = { teamId: 'teamId', edfiTenantId: 'edfiTenantId', id: '__filtered__' };

  it('jobs/create/:jobId requires team.sb-environment.edfi-tenant:create-ods', () => {
    const meta = Reflect.getMetadata(AUTHORIZE_KEY, OdssController.prototype.getCreateJob);
    expect(meta.privilege).toBe('team.sb-environment.edfi-tenant:create-ods');
    expect(meta.subject).toEqual(subject);
  });

  it('jobs/delete/:jobId requires team.sb-environment.edfi-tenant:delete-ods', () => {
    const meta = Reflect.getMetadata(AUTHORIZE_KEY, OdssController.prototype.getDeleteJob);
    expect(meta.privilege).toBe('team.sb-environment.edfi-tenant:delete-ods');
    expect(meta.subject).toEqual(subject);
  });
});
