import { Logger, NotFoundException } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const throwNotFound = (err: any) => {
  Logger.log(err);
  throw new NotFoundException();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const throwNotFoundText = (text: string) => (err: any) => {
  Logger.log(err);
  throw new NotFoundException(text);
};
