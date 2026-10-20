import { OdsManageJobData } from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { IJobQueueService } from './job-queue/job-queue.interface';
import { ODS_MANAGE_CHNL } from './sb-sync.module';

const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 500;

/**
 * Queues an `ods-manage` job and waits only until its row is visible in the sync queue view
 * (not until it finishes), so the caller can return the job to the frontend quickly.
 */
export async function queueOdsManageJob(
  jobQueue: IJobQueueService,
  queueRepository: Repository<SbSyncQueue>,
  data: OdsManageJobData
): Promise<SbSyncQueue> {
  const id = await jobQueue.send(ODS_MANAGE_CHNL, data, {
    // pg-boss 12 only honors expireInSeconds; the handler polls Admin API for up to ~1h.
    expireInSeconds: 7200,
    retryLimit: 0,
  });

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const queueItem = await queueRepository.findOneBy({ id });
    if (queueItem) return queueItem;
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const fallback = new SbSyncQueue();
  fallback.id = id;
  fallback.state = 'created';
  return fallback;
}
