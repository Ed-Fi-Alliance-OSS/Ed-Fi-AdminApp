import { certificationUnsupportedMessage, supportsCertification } from '@edanalytics/models';
import { SbEnvironment } from '@edanalytics/models-server';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { CustomHttpException } from '../utils/customExceptions';

/**
 * Refuses certification requests for environments below the minimum Ed-Fi data model
 * (MIN_CERTIFICATION_DATA_MODEL), or whose data model can't be determined, so a direct URL
 * can't bypass the hidden UI action (AC-677). A 400 with a message, not the 404 the SbVersion
 * gate uses, because the environment exists and the user needs to know what to change.
 * Must run after SbEnvironmentEdfiTenantInterceptor, which puts the environment on the request.
 */
@Injectable()
export class CertificationSupportInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const sbEnvironment: SbEnvironment | undefined = context.switchToHttp().getRequest().sbEnvironment;
    // No environment means a non-numeric ID; interceptors run before pipes, so let
    // ParseIntPipe answer with its 400.
    if (!sbEnvironment) return next.handle();
    if (!supportsCertification(sbEnvironment.odsDsVersion)) {
      throw new CustomHttpException(
        {
          type: 'Error',
          title: 'Certification is not available for this environment.',
          message: certificationUnsupportedMessage(sbEnvironment.odsDsVersion),
        },
        400,
      );
    }
    return next.handle();
  }
}
