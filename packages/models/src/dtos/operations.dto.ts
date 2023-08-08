import { IWorkflowFailureErrors, StatusType } from '@edanalytics/utils';
import { Expose } from 'class-transformer';
import { makeSerializer } from '../utils';

export class OperationResultDto implements IWorkflowFailureErrors {
  @Expose()
  title: string;

  @Expose()
  status: StatusType;

  @Expose()
  message?: string;

  @Expose()
  regarding?: string;
}

export const toOperationResultDto = makeSerializer(OperationResultDto);
