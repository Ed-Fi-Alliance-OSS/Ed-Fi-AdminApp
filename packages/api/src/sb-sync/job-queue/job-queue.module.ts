import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobQueue } from '@edanalytics/models-server';
import config from 'config';
import PgBoss from 'pg-boss';
import { PgBossAdapter } from './pg-boss-adapter.service';
import { NotImplementedJobQueueService } from './not-implemented-job-queue.service';

// Only import TypeORM repositories for MSSQL; avoids metadata-validation errors on
// PostgreSQL deployments where the job_queue table does not exist (D-12).
const mssqlImports = config.DB_ENGINE === 'mssql' ? [TypeOrmModule.forFeature([JobQueue])] : [];

@Global()
@Module({
  imports: [...mssqlImports],
  providers: [
    {
      provide: 'IJobQueueService',
      useFactory: (boss: PgBoss | null) => {
        if (config.DB_ENGINE !== 'mssql') {
          return new PgBossAdapter(boss!);
        }
        // Phase 2 (T2-xx): MssqlJobQueueService will be wired here.
        // For now, return a stub that throws ServiceUnavailableException so
        // MSSQL deployments fail fast with an actionable error instead of
        // a null-dereference crash.
        return new NotImplementedJobQueueService();
      },
      // PgBossInstance is null on MSSQL (pg-boss.module.ts guards it), so the factory
      // receives null and falls into the MSSQL branch above.
      inject: ['PgBossInstance'],
    },
  ],
  exports: ['IJobQueueService'],
})
export class JobQueueModule {}
