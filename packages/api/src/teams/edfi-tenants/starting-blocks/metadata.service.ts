import { InvokeCommand, LambdaClient, LambdaServiceException } from '@aws-sdk/client-lambda';
import { parse, validate } from '@aws-sdk/util-arn-parser';
import { SbV1MetaEnv, SbV2MetaEnv } from '@edanalytics/models';
import { SbEnvironment } from '@edanalytics/models-server';
import { Injectable, Logger } from '@nestjs/common';

/* eslint @typescript-eslint/no-explicit-any: 0 */ // --> OFF
@Injectable()
export class MetadataService {
  private readonly logger = new Logger(this.constructor.name);
  async getMetadata<MetaType extends SbV1MetaEnv | SbV2MetaEnv = SbV1MetaEnv | SbV2MetaEnv>(
    sbEnvironment: SbEnvironment
  ) {
    if (!validate(sbEnvironment.configPublic?.sbEnvironmentMetaArn ?? '')) {
      this.logger.warn(`ARN sbEnvironmentMetaArn in ${sbEnvironment.envLabel} is not valid`);
      return {
        status: 'NO_CONFIG' as const,
      };
    }
    const arn = parse(sbEnvironment.configPublic.sbEnvironmentMetaArn);
    const client = new LambdaClient({
      region: arn.region,
      retryMode: 'adaptive',
      maxAttempts: 5,
    });
    try {
      const result = await client.send(
        new InvokeCommand({
          FunctionName: sbEnvironment.configPublic.sbEnvironmentMetaArn,
          InvocationType: 'RequestResponse',
        })
      );
      const payload = JSON.parse(Buffer.from(result.Payload).toString('utf8'));
      if ('errorMessage' in payload) {
        Logger.error(payload);
        return {
          status: 'FAILURE' as const,
          error: payload.errorMessage as string,
          data: payload as any,
        };
      }
      return {
        status: 'SUCCESS' as const,
        data: payload as MetaType,
      };
    } catch (LambdaError: unknown) {
      const err = LambdaError as LambdaServiceException;
      Logger.error(LambdaError);
      return {
        status: 'FAILURE' as const,
        error: err.message ? (err.message as string) : 'Failed to execute SB Lambda',
      };
    }
  }
}
