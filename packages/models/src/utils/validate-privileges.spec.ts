import 'reflect-metadata';
import { validate } from 'class-validator';
import { IsValidPrivileges } from './validate-privileges';
import { PrivilegeCode } from '../types';

class TestDto {
  @IsValidPrivileges()
  privilegeIds: PrivilegeCode[];
}

describe('IsValidPrivileges', () => {
  it('passes when all privileges have their dependencies met', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['role:read', 'user:read', 'user:create'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes for an empty array', async () => {
    const dto = new TestDto();
    dto.privilegeIds = [];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when a privilege is missing a required dependency', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['user:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('privilegeIds');
  });

  it('fails when ods:read is present but sb-environment.edfi-tenant:read is missing', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['ods:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('passes for standalone privileges that have no dependencies', async () => {
    const dto = new TestDto();
    dto.privilegeIds = ['role:read'];
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects certification:read without ods:read', async () => {
    const dto = new TestDto();
    dto.privilegeIds = [
      'team.sb-environment:read',
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods.certification:read',
    ];
    expect(await validate(dto)).toHaveLength(1);
  });

  it('rejects certification:run without certification:read', async () => {
    const dto = new TestDto();
    dto.privilegeIds = [
      'team.sb-environment:read',
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.certification:run',
    ];
    expect(await validate(dto)).toHaveLength(1);
  });

  it('accepts the Certification vendor privilege set', async () => {
    const dto = new TestDto();
    dto.privilegeIds = [
      'team.sb-environment:read',
      'team.sb-environment.edfi-tenant:read',
      'team.sb-environment.edfi-tenant.ods:read',
      'team.sb-environment.edfi-tenant.ods.certification:read',
      'team.sb-environment.edfi-tenant.ods.certification:run',
    ];
    expect(await validate(dto)).toHaveLength(0);
  });
});
