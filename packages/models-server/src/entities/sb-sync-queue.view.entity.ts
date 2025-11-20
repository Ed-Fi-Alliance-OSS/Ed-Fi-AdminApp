import { ISbSyncQueue, PgBossJobState } from '@edanalytics/models';
import { Index, ViewColumn, ViewEntity } from 'typeorm';

@Index('sb_sync_queue_tsvector', {
  synchronize: false,
})
@ViewEntity({
  expression: `with job as (select id, name, data, state, createdon, completedon, output
    from pgboss.job
    where name in ('sbe-sync', 'edfi-tenant-sync')
    union
    select id, name, data, state, createdon, completedon, output
    from pgboss.archive
    where name in ('sbe-sync', 'edfi-tenant-sync'))
select job."id",
case when job."name" = 'sbe-sync' then 'SbEnvironment' else 'EdfiTenant' end     "type",
coalesce(sb_environment."name", edfi_tenant."name", 'resource no longer exists') "name",
coalesce(sb_environment."id", edfi_tenant."sbEnvironmentId")                     "sbEnvironmentId",
edfi_tenant."id"                                                                 "edfiTenantId",
"data"::text                                                                     "dataText",
data,
state,
createdon,
completedon,
output,
(job.output -> 'hasChanges')::bool                                               "hasChanges"
from job
left join public.sb_environment on (job.data -> 'sbEnvironmentId')::int = sb_environment.id
left join public.edfi_tenant on (job.data -> 'edfiTenantId')::int = edfi_tenant.id`,
  materialized: true,
})
export class SbSyncQueue implements ISbSyncQueue {
  @ViewColumn()
  id: string;
  @ViewColumn()
  type: 'SbEnvironment' | 'EdfiTenant';
  @ViewColumn()
  name: string | 'resource no longer exists';
  @ViewColumn()
  sbEnvironmentId: number | null;
  @ViewColumn()
  edfiTenantId: number | null;
  @ViewColumn()
  dataText: string;
  @ViewColumn()
  data: { sbEnvironmentId: number } | { edfiTenantId: number };
  @ViewColumn()
  state: PgBossJobState;
  @ViewColumn()
  createdon: Date;
  @ViewColumn()
  completedon: Date;
  @ViewColumn()
  output: object;
  @ViewColumn()
  hasChanges: boolean | null | undefined;
}
