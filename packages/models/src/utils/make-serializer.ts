import { ClassConstructor, plainToInstance } from 'class-transformer';
import { GettersOmit } from './get-base.dto';

export const makeSerializer = <BaseType, InputType = Omit<BaseType, GettersOmit>>(
  dto: ClassConstructor<BaseType>
) => {
  function serialize(input: InputType): BaseType;
  function serialize(input: InputType[]): BaseType[];
  function serialize(input: InputType | InputType[]) {
    if (Array.isArray(input)) {
      return plainToInstance(dto, input, { excludeExtraneousValues: true });
    } else {
      return plainToInstance(dto, input, { excludeExtraneousValues: true });
    }
  }

  return serialize;
};
