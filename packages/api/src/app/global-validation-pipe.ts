import { formErrFromValidator } from '@edanalytics/utils';
import { ValidationPipe } from '@nestjs/common';
import { CustomHttpException } from '../utils/customExceptions';

/**
 * Builds the global `ValidationPipe` that validates and transforms every
 * class-typed `@Body()`/`@Query()` parameter.
 *
 * `excludeExtraneousValues` limits the transformed DTO to `@Expose()`d
 * properties, so clients cannot mass-assign server-controlled columns such as
 * `id`, `createdById` or `modifiedById` (AC-642). `exposeUnsetFields: false`
 * keeps properties the client did not send absent rather than `undefined`,
 * which `applyDtoUpdates` relies on for partial updates.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    transformOptions: {
      excludeExtraneousValues: true,
      exposeUnsetFields: false,
    },
    stopAtFirstError: false,
    exceptionFactory: (validationErrors = []) => {
      return new CustomHttpException({
        type: 'ValidationError',
        title: 'Invalid submission.',
        data: { errors: formErrFromValidator(validationErrors) },
      });
    },
  });
}
