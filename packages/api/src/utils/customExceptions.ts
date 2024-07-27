import {
  StatusResponse,
  StatusResponseForceDelete,
  StatusResponseFormValidation,
  StatusResponseGeneral,
  formValidationResult,
} from '@edanalytics/utils';
import { HttpException } from '@nestjs/common';

export interface IAdminApiValidationError {
  title: 'Validation failed';
  status: 400;
  /**
   * Field names are in upper camel case.
   *
   * @example { "Name": [ "A claim set with this name already exists in the database." ] }
   */
  errors: {
    [FieldName: string]: [string];
  };
}

export interface IAdminApiV1xGenericError {
  message: 'The server encountered an unexpected condition that prevented it from fulfilling the request.';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isIAdminApiValidationError = (error: any): error is IAdminApiValidationError => {
  return (
    error &&
    error?.title === 'Validation failed' &&
    typeof error.errors === 'object' &&
    Object.values(error.errors).every(
      (v) => Array.isArray(v) && v.every((v) => typeof v === 'string')
    )
  );
};
export class CustomHttpException extends HttpException {
  constructor(info: StatusResponseGeneral, status: number);
  constructor(info: StatusResponseFormValidation);
  constructor(info: StatusResponseForceDelete);
  constructor(info: StatusResponse, status?: number) {
    super(
      info.type === 'ValidationError' ? { ...info, title: 'Invalid submission.' } : info,
      info.type === 'ValidationError' ? 400 : info.type === 'RequiresForceDelete' ? 409 : status
    );
  }
}

export class ValidationHttpException extends CustomHttpException {
  constructor(...errors: { field: string; message: string }[]);
  constructor(error: string);
  constructor(...errors: [string] | { field: string; message: string }[]) {
    super({
      type: 'ValidationError',
      title: 'Invalid submission.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { errors: formValidationResult(...(errors as any)) },
    });
  }
}
