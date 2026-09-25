import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { describeHealthError } from './health-error';

const HEALTH_CHECK_TIMEOUT_MS = 3000;

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    api: {
      status: 'healthy' | 'unhealthy';
      message?: string;
    };
    database: {
      status: 'healthy' | 'unhealthy';
      message?: string;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private pendingCheck: Promise<boolean> | undefined;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getHealth(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const isAvailable = await this.checkDatabase();
    const status = isAvailable ? 'healthy' : 'unhealthy';
    return {
      status,
      timestamp,
      checks: {
        api: { status: 'healthy', message: 'API is responding' },
        database: {
          status,
          message: isAvailable ? 'Database connection successful' : 'Database connection failed',
        },
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          this.logger.warn(
            `Database health check response timeout after ${HEALTH_CHECK_TIMEOUT_MS} ms`,
          );
          resolve(false);
        }, HEALTH_CHECK_TIMEOUT_MS);
      });
      // A response timeout does not cancel pooled work; share it until cleanup settles.
      this.pendingCheck ??= this.performDatabaseCheck().finally(() => {
        this.pendingCheck = undefined;
      });
      return await Promise.race([this.pendingCheck, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async performDatabaseCheck(): Promise<boolean> {
    let runner: QueryRunner | undefined;
    let phase = 'connection';
    try {
      runner = this.dataSource.createQueryRunner();
      await runner.connect();
      phase = 'query';
      await runner.query('SELECT 1');
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Database health check ${phase} failed: ${describeHealthError(error)}`);
      return false;
    } finally {
      if (runner) {
        try {
          await runner.release();
        } catch (cleanupError: unknown) {
          this.logger.warn(
            `Database health check cleanup failed: ${describeHealthError(cleanupError)}`,
          );
        }
      }
    }
  }
}
