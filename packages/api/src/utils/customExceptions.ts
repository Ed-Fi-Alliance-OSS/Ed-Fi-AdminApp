import {
  ErrorCode,
  IWorkflowFailureErrors,
  VALIDATION_RESP_TYPE,
  WORKFLOW_FAILURE_RESP_TYPE,
} from '@edanalytics/utils';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FieldErrors } from 'react-hook-form';

export class ValidationException extends BadRequestException {
  constructor(errors: FieldErrors) {
    super({
      message: 'Invalid submission.',
      type: VALIDATION_RESP_TYPE,
      errors,
    });
  }
}

export class WorkflowFailureException extends InternalServerErrorException {
  constructor(errors: IWorkflowFailureErrors, code?: ErrorCode) {
    super({
      message: 'Operation failure',
      type: WORKFLOW_FAILURE_RESP_TYPE,
      ...(code ? { code } : {}),
      errors,
    });
  }
}
