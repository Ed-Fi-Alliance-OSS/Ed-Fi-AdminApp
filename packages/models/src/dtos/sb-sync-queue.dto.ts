import { Expose, Type } from 'class-transformer';
import { ISbSyncQueue, PgBossJobState } from '../interfaces';
import { makeSerializer } from '../utils/make-serializer';

// This is a Get DTO that should not have whitespace trimmed
export class SbSyncQueueDto implements ISbSyncQueue {
  @Expose()
  id: string;
  @Expose()
  type: 'SbEnvironment' | 'EdfiTenant';
  @Expose()
  name: string | 'resource no longer exists';
  @Expose()
  sbEnvironmentId: number | null;
  @Expose()
  edfiTenantId: number | null;
  @Expose()
  dataText: string;
  @Expose()
  data:
    | { sbEnvironmentId: number; edfiTenantId?: undefined }
    | { sbEnvironmentId?: undefined; edfiTenantId: number };
  @Expose()
  state: PgBossJobState;
  @Expose()
  @Type(() => Date)
  createdon: Date;
  @Expose()
  @Type(() => Date)
  completedon: Date;
  @Expose()
  output: object;
  @Expose()
  hasChanges: boolean | null | undefined;

  get displayName() {
    return this.name;
  }

  get completedOnNumber() {
    return this.completedon ? Number(this.completedon) : undefined;
  }
  get createdOnNumber() {
    return this.createdon ? Number(this.createdon) : undefined;
  }

  get durationNumber() {
    return this.completedOnNumber !== undefined && this.createdOnNumber !== undefined
      ? this.completedOnNumber - this.createdOnNumber
      : undefined;
  }
}
export const toSbSyncQueueDto = makeSerializer<
  SbSyncQueueDto,
  Omit<SbSyncQueueDto, 'createdOnNumber' | 'completedOnNumber' | 'displayName' | 'durationNumber'>
>(SbSyncQueueDto);

export class SyncQueuePaginatedResults {
  @Expose()
  @Type(() => SbSyncQueueDto)
  data: SbSyncQueueDto[];
  @Expose()
  rowCount: number;
}
export const toSyncQueuePaginatedResults = makeSerializer(SyncQueuePaginatedResults);
export class SbSyncQueueFacetedValuesDto {
  /** unique */
  @Expose()
  type: ('SbEnvironment' | 'EdfiTenant')[];
  /** unique */
  @Expose()
  dataText: (string | 'resource no longer exists')[];
  /** unique */
  @Expose()
  state: PgBossJobState[];
  /** unique */
  @Expose()
  hasChanges: (boolean | null | undefined)[];

  /** min/max */
  @Expose()
  @Type(() => Date)
  createdon: [Date | null, Date | null];
  /** min/max */
  @Expose()
  @Type(() => Date)
  completedon: [Date | null, Date | null];
}
export const toSbSyncQueueFacetedValuesDto = makeSerializer(SbSyncQueueFacetedValuesDto);
