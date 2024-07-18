import { SetMetadata } from '@nestjs/common';

export const SB_VERSION = 'sbVersion';
export const OPERATION = 'operation';
export const SbVersion = (version: string) => SetMetadata(SB_VERSION, version);
export const Operation = (operationString = 'This operation') =>
  SetMetadata(OPERATION, operationString);
