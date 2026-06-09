import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { PgBossAdapter } from './pg-boss-adapter.service';

// ---------------------------------------------------------------------------
// pg-boss ships as ESM – jest.mock prevents the ESM loader from running.
// We only need the mock object passed to the PgBossAdapter constructor so we
// do not need any type import from 'pg-boss'.
// ---------------------------------------------------------------------------
jest.mock('pg-boss', () => ({}));

// ---------------------------------------------------------------------------
// Minimal pg-boss mock – only the methods exercised by PgBossAdapter
// ---------------------------------------------------------------------------

interface MockBoss {
  start: jest.Mock;
  stop: jest.Mock;
  createQueue: jest.Mock;
  send: jest.Mock;
  findJobs: jest.Mock;
  getJobById: jest.Mock;
  schedule: jest.Mock;
  work: jest.Mock;
}

function buildPgBossMock(): MockBoss {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    createQueue: jest.fn().mockResolvedValue(undefined),
    send: jest.fn(),
    findJobs: jest.fn().mockResolvedValue([]),
    getJobById: jest.fn(),
    schedule: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(undefined),
  };
}

/** Build a minimal JobWithMetadata shape as returned by pg-boss v12. */
function buildPgJob(overrides: Partial<{
  id: string;
  name: string;
  state: 'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed';
  singletonKey: string | null;
}> = {}) {
  return {
    id: overrides.id ?? 'uuid-1234',
    name: overrides.name ?? 'test-queue',
    data: {},
    state: overrides.state ?? 'active',
    priority: 0,
    retryLimit: 0,
    retryCount: 0,
    retryDelay: 0,
    retryBackoff: false,
    startAfter: new Date(),
    startedOn: new Date(),
    singletonKey: overrides.singletonKey ?? null,
    singletonOn: null,
    expireInSeconds: 0,
    deleteAfterSeconds: 0,
    createdOn: new Date(),
    completedOn: null,
    keepUntil: new Date(),
    policy: 'standard' as const,
    heartbeatOn: null,
    heartbeatSeconds: null,
    deadLetter: '',
    output: {},
    signal: new AbortController().signal,
  };
}

// ---------------------------------------------------------------------------

describe('PgBossAdapter', () => {
  let boss: ReturnType<typeof buildPgBossMock>;
  let adapter: PgBossAdapter;

  beforeEach(() => {
    boss = buildPgBossMock();
    adapter = new PgBossAdapter(boss as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // send() — normal (non-dedup) path
  // -------------------------------------------------------------------------

  describe('send() — normal path', () => {
    it('stores queueName in the map and returns the job id', async () => {
      boss.send.mockResolvedValue('uuid-abc');

      const returned = await adapter.send('my-queue', null);

      expect(returned).toBe('uuid-abc');
      // Verify the map entry exists by successfully calling getJobById
      boss.getJobById.mockResolvedValue(buildPgJob({ id: 'uuid-abc', state: 'active' }));
      await expect(adapter.getJobById('uuid-abc')).resolves.toMatchObject({ id: 'uuid-abc' });
    });
  });

  // -------------------------------------------------------------------------
  // send() — dedup path (boss.send returns null)
  // -------------------------------------------------------------------------

  describe('send() — dedup path', () => {
    it('resolves the real UUID via findJobs when singletonKey is provided and job exists', async () => {
      boss.send.mockResolvedValue(null);
      const realJob = buildPgJob({ id: 'real-uuid', state: 'active' });
      boss.findJobs.mockResolvedValue([realJob]);

      const returned = await adapter.send('my-queue', null, { singletonKey: 'my-key' });

      expect(returned).toBe('real-uuid');
      expect(boss.findJobs).toHaveBeenCalledWith('my-queue', { key: 'my-key' });
    });

    it('resolves the real UUID via findJobs when no singletonKey (queue-policy dedup)', async () => {
      boss.send.mockResolvedValue(null);
      const realJob = buildPgJob({ id: 'real-uuid-2', state: 'created' });
      boss.findJobs.mockResolvedValue([realJob]);

      const returned = await adapter.send('my-queue', null);

      expect(returned).toBe('real-uuid-2');
      // findJobs called with empty options (no key filter)
      expect(boss.findJobs).toHaveBeenCalledWith('my-queue', {});
    });

    it('stores the real UUID in the map so getJobById succeeds (singletonKey case)', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([buildPgJob({ id: 'real-uuid', state: 'active' })]);

      const id = await adapter.send('my-queue', null, { singletonKey: 'k' });

      boss.getJobById.mockResolvedValue(buildPgJob({ id: 'real-uuid', state: 'active' }));
      await expect(adapter.getJobById(id)).resolves.toMatchObject({ id: 'real-uuid' });
      expect(boss.getJobById).toHaveBeenCalledWith('my-queue', 'real-uuid');
    });

    it('stores sentinel → queueName in the map when findJobs returns empty (race condition)', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([]);

      const id = await adapter.send('my-queue', null, { singletonKey: 'race-key' });

      // Sentinel is the singletonKey
      expect(id).toBe('race-key');
      // Map has entry, so pg-boss lookup is attempted (not an immediate NotFoundException)
      boss.getJobById.mockResolvedValue(null); // pg-boss returns null for sentinel id
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      // Confirm pg-boss was actually called (not short-circuited by missing map entry)
      expect(boss.getJobById).toHaveBeenCalledWith('my-queue', 'race-key');
    });

    it('uses "deduped" sentinel when no singletonKey and findJobs is empty', async () => {
      boss.send.mockResolvedValue(null);
      boss.findJobs.mockResolvedValue([]);

      const id = await adapter.send('my-queue', null);

      expect(id).toBe('deduped');
      boss.getJobById.mockResolvedValue(null);
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).toHaveBeenCalledWith('my-queue', 'deduped');
    });
  });

  // -------------------------------------------------------------------------
  // getJobById() — map cleanup on terminal state
  // -------------------------------------------------------------------------

  describe('getJobById() — map cleanup', () => {
    const TERMINAL_STATES = ['completed', 'failed', 'cancelled', 'expired'] as const;
    const NON_TERMINAL_STATES = ['created', 'retry', 'active'] as const;

    it.each(TERMINAL_STATES)(
      'removes map entry after returning a "%s" job',
      async (state) => {
        boss.send.mockResolvedValue('uuid-term');
        await adapter.send('q', null);

        // pg-boss reports terminal state
        const pgJobState = state === 'expired' ? 'failed' : (state as 'completed' | 'failed' | 'cancelled');
        // We mock the raw pg-boss state to the terminal state via the adapter's internal mapping.
        // For 'expired', pg-boss v12 stores 'failed' with expiry; simulate via the adapter's
        // TERMINAL_STATES set which includes 'expired'.  Instead, mock getJobById to return a
        // fabricated state value matching exactly what the adapter checks.
        boss.getJobById.mockResolvedValue({ ...buildPgJob({ id: 'uuid-term' }), state } as ReturnType<typeof buildPgJob>);

        const job = await adapter.getJobById('uuid-term');
        expect(job.state).toBe(state);

        // Second call must fail with NotFoundException (entry was cleaned up)
        await expect(adapter.getJobById('uuid-term')).rejects.toThrow(NotFoundException);
        // pg-boss should NOT be called again for the second attempt
        expect(boss.getJobById).toHaveBeenCalledTimes(1);
      }
    );

    it.each(NON_TERMINAL_STATES)(
      'keeps map entry for non-terminal "%s" state',
      async (state) => {
        boss.send.mockResolvedValue('uuid-live');
        await adapter.send('q', null);

        boss.getJobById.mockResolvedValue(buildPgJob({ id: 'uuid-live', state }));

        await adapter.getJobById('uuid-live');

        // Entry still present — second call reaches pg-boss
        boss.getJobById.mockResolvedValue(buildPgJob({ id: 'uuid-live', state }));
        await expect(adapter.getJobById('uuid-live')).resolves.toMatchObject({ id: 'uuid-live' });
        expect(boss.getJobById).toHaveBeenCalledTimes(2);
      }
    );
  });

  // -------------------------------------------------------------------------
  // getJobById() — unknown id (never sent)
  // -------------------------------------------------------------------------

  describe('getJobById() — unknown id', () => {
    it('throws NotFoundException immediately without calling pg-boss', async () => {
      await expect(adapter.getJobById('unknown-id')).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // send() + getJobById() — triggerSync flow simulation
  // -------------------------------------------------------------------------

  describe('triggerSync flow — dedup then poll', () => {
    it('polls the real job UUID returned from findJobs until completed, then cleans up', async () => {
      // First caller sends, gets a real UUID
      boss.send.mockResolvedValue('job-uuid');
      const id = await adapter.send('sync-queue', null);
      expect(id).toBe('job-uuid');

      // Poll 1 — still active
      boss.getJobById.mockResolvedValueOnce(buildPgJob({ id: 'job-uuid', state: 'active' }));
      const active = await adapter.getJobById(id);
      expect(active.state).toBe('active');

      // Poll 2 — completed (terminal)
      boss.getJobById.mockResolvedValueOnce({ ...buildPgJob({ id: 'job-uuid' }), state: 'completed' } as ReturnType<typeof buildPgJob>);
      const done = await adapter.getJobById(id);
      expect(done.state).toBe('completed');

      // Map cleaned up — third call must throw
      await expect(adapter.getJobById(id)).rejects.toThrow(NotFoundException);
      expect(boss.getJobById).toHaveBeenCalledTimes(2);
    });

    it('second concurrent send (dedup) resolves same real UUID and can poll', async () => {
      // First send gets a real UUID
      boss.send.mockResolvedValueOnce('shared-uuid');
      await adapter.send('sync-queue', null);

      // Second send is deduped; findJobs returns the existing job
      boss.send.mockResolvedValueOnce(null);
      boss.findJobs.mockResolvedValue([buildPgJob({ id: 'shared-uuid', state: 'active' })]);
      const id2 = await adapter.send('sync-queue', null);

      // Both resolve to the same UUID
      expect(id2).toBe('shared-uuid');

      boss.getJobById.mockResolvedValue(buildPgJob({ id: 'shared-uuid', state: 'active' }));
      await expect(adapter.getJobById(id2)).resolves.toMatchObject({ id: 'shared-uuid' });
    });
  });
});
