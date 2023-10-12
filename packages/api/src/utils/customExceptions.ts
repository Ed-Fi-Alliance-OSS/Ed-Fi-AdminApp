import {
  StatusResponse,
  StatusResponseForceDelete,
  StatusResponseFormValidation,
  StatusResponseGeneral,
  formValidationResult,
} from '@edanalytics/utils';
import { HttpException } from '@nestjs/common';

export interface IAdminApiV1xValidationError {
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

export const isIAdminApiV1xValidationError = (error: any): error is IAdminApiV1xValidationError => {
  return (
    error &&
    error?.title === 'Validation failed' &&
    error.status === 400 &&
    typeof error.errors === 'object' &&
    Object.values(error.errors).every(
      (v) => Array.isArray(v) && v.every((v) => typeof v === 'string')
    )
  );
};
export class CustomHttpException extends HttpException {
  constructor(info: StatusResponseForceDelete);
  constructor(info: StatusResponseFormValidation);
  constructor(info: StatusResponseGeneral, status: number);
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
      data: { errors: formValidationResult(...(errors as any)) },
    });
  }
}
