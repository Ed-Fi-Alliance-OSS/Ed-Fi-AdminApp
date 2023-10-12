import { toOperationResultDto, toSbSyncQueueDto } from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import PgBoss from 'pg-boss';
import { Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { PgBossInstance, SYNC_SCHEDULER_CHNL } from './sb-sync.module';
import _ from 'lodash';

@ApiTags('SB Sync Queue')
@Controller()
export class SbSyncController {
  constructor(
    @Inject('PgBossInstance')
    private readonly boss: PgBossInstance,
    @InjectRepository(SbSyncQueue) private readonly queueRepository: Repository<SbSyncQueue>
  ) {}

  @Get()
  @Authorize({
    privilege: 'sb-sync-queue:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findAll() {
    return toSbSyncQueueDto(await this.queueRepository.find());
  }

  @Get(':sbSyncQueueId')
  @Authorize({
    privilege: 'sb-sync-queue:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(@Param('sbSyncQueueId') sbSyncQueueId: string) {
    return toSbSyncQueueDto(await this.queueRepository.findOneBy({ id: sbSyncQueueId }));
  }

  @Post()
  @Authorize({
    privilege: 'sbe:refresh-resources',
    subject: {
      id: '__filtered__',
    },
  })
  async triggerSync() {
    const boss = this.boss;
    const id = await boss.send({ name: SYNC_SCHEDULER_CHNL });
    return new Promise((r) => {
      let job: PgBoss.JobWithMetadata<object>;
      const timer = setInterval(poll, 500);
      let i = 0;
      async function poll() {
        job = await boss.getJobById(id);
        if (i === 120 || job.completedon !== null) {
          clearInterval(timer);
          r(
            toOperationResultDto(
              job.state === 'completed'
                ? {
                    type: 'Success',
                    title: 'Sync queued',
                  }
                : job.state === 'failed'
                ? {
                    type: 'Error',
                    title: 'Failed to queue sync',
                    data: _.omit(job.output, 'stack'),
                  }
                : {
                    type: 'Warning',
                    title: 'Unknown issue',
                    data: _.pick(job, [
                      'state',
                      'retrylimit',
                      'retrycount',
                      'retrydelay',
                      'retrybackoff',
                      'startedon',
                      'expirein',
                      'createdon',
                      'completedon',
                      'keepuntil',
                      'output',
                    ]),
                  }
            )
          );
        }
        i++;
      }
    });
  }
}
