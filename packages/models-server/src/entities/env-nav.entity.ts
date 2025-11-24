import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  expression: `
  select "name" "sbEnvironmentName", "id" "sbEnvironmentId", null "edfiTenantName", null "edfiTenantId"
from sb_environment
union
select sb_environment."name",
       sb_environment."id",
       edfi_tenant."name",
       edfi_tenant."id"
from sb_environment
         right join edfi_tenant on sb_environment.id = edfi_tenant."sbEnvironmentId";`,
})
export class EnvNav {
  @ViewColumn()
  sbEnvironmentId: number;

  @ViewColumn()
  sbEnvironmentName: string;

  @ViewColumn()
  edfiTenantId: null | number;

  @ViewColumn()
  edfiTenantName: null | string;
}
