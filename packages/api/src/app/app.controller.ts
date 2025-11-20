import { Controller, Get, Header, Logger, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import axios from 'axios';
import config from 'config';
import { Public } from '../auth/authorization/public.decorator';
import { Throttle } from '@nestjs/throttler';

class SecretIdDto {
  @IsUUID(4, { message: 'secretId must be a valid UUID' })
  secretId: string;
}
import { HealthStatus, HealthService } from './health.service';

@ApiTags('App')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('healthcheck')
  async healthcheck(): Promise<HealthStatus> {
    try {
      this.logger.log('Healthcheck endpoint called');
      return await this.healthService.getHealth();
    } catch (error) {
      this.logger.error('Healthcheck error:', error);

      // Return a safe fallback response instead of throwing
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          api: {
            status: 'healthy',
            message: 'API is responding'
          },
          database: {
            status: 'unhealthy',
            message: error instanceof Error ? `Health check failed: ${error.message}` : 'Health check failed: Unknown error'
          }
        }
      };
    }
  }

  // Override default configuration for Rate limiting and duration.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('secret/:secretId/')
  secret(@Param() params: SecretIdDto) {
    const yopassUrl = new URL(`/secret/${encodeURIComponent(params.secretId)}`, config.YOPASS_URL);

    return axios
      .get(yopassUrl.toString())
      .then((res) => {
        return res.data;
      })
      .catch((err) => {
        Logger.warn(err);
        throw new NotFoundException('Secret not found.');
      });
  }
}
