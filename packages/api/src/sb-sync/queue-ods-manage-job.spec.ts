import { OdsManageJobData } from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { IJobQueueService } from './job-queue/job-queue.interface';
import { queueOdsManageJob } from './queue-ods-manage-job';
import { ODS_MANAGE_CHNL } from './sb-sync.module';

describe('queueOdsManageJob', () => {
  const data: OdsManageJobData = {
    sbEnvironmentId: 2,
    edfiTenantId: 1,
    adminApiJobId: 'CreateInstanceJob-7_abc',
    operation: 'create',
    odsName: 'my-ods',
    odsId: 9,
  };
  const send = jest.fn();
  const findOneBy = jest.fn();
  const jobQueue = { send } as unknown as IJobQueueService;
  const repo = { findOneBy } as unknown as Repository<SbSyncQueue>;

  beforeEach(() => {
    jest.useFakeTimers();
    send.mockReset().mockResolvedValue('job-1');
    findOneBy.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('sends with retryLimit 0 and returns the row once it exists', async () => {
    findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'job-1', state: 'active' });
    const promise = queueOdsManageJob(jobQueue, repo, data);
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toEqual({ id: 'job-1', state: 'active' });
    expect(send).toHaveBeenCalledWith(ODS_MANAGE_CHNL, data, { expireInHours: 2, retryLimit: 0 });
    expect(findOneBy).toHaveBeenCalledWith({ id: 'job-1' });
  });

  it('falls back to a created row when it never appears', async () => {
    findOneBy.mockResolvedValue(null);
    const promise = queueOdsManageJob(jobQueue, repo, data);
    await jest.advanceTimersByTimeAsync(500 * 20);
    const result = await promise;
    expect(result.id).toBe('job-1');
    expect(result.state).toBe('created');
    expect(findOneBy).toHaveBeenCalledTimes(20);
  });
});
