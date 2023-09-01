import { stdDetailed, stdDiffSeconds, stdDuration } from '@edanalytics/utils';
import { Expose, Type } from 'class-transformer';
import { ISbSyncQueue, PgBossJobState } from '../interfaces';
import { makeSerializer } from '../utils/make-serializer';
import dayjs from 'dayjs';

export class SbSyncQueueDto implements ISbSyncQueue {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  priority: number;

  @Expose()
  data: object;

  @Expose()
  state: PgBossJobState;

  @Expose()
  retrylimit: number;

  @Expose()
  retrycount: number;

  @Expose()
  retrydelay: number;

  @Expose()
  retrybackoff: boolean;

  @Expose()
  @Type(() => Date)
  startafter: Date;

  @Expose()
  @Type(() => Date)
  startedon: Date;

  @Expose()
  singletonkey: string;

  @Expose()
  singletonon: Date | null;

  @Expose()
  @Type(() => Date)
  expirein: Date;

  @Expose()
  @Type(() => Date)
  createdon: Date;

  @Expose()
  @Type(() => Date)
  completedon: Date | null;

  @Expose()
  @Type(() => Date)
  keepuntil: Date;

  @Expose()
  on_complete: boolean;

  @Expose()
  output: object;

  @Expose()
  @Type(() => Date)
  archivedon: Date | null;

  get sbeId() {
    return (this.data as any)?.sbeId as number;
  }

  get displayName() {
    return `${this.name} - SBE ${this.sbeId}`;
  }

  get durationDetailed() {
    return this.createdon && this.completedon
      ? stdDuration(dayjs(this.completedon).diff(this.createdon, 'second'))
      : undefined;
  }

  get completedDetailed() {
    return this.completedon ? stdDetailed(this.completedon) : undefined;
  }
  get createdDetailed() {
    return this.createdon ? stdDetailed(this.createdon) : undefined;
  }
}
export const toSbSyncQueueDto = makeSerializer<
  SbSyncQueueDto,
  Omit<
    SbSyncQueueDto,
    'completedDetailed' | 'createdDetailed' | 'durationDetailed' | 'sbeId' | 'displayName'
  >
>(SbSyncQueueDto);
