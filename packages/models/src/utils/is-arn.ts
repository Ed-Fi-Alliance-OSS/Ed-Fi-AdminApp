import { registerDecorator } from 'class-validator';
import { validate as validateArn } from '@aws-sdk/util-arn-parser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = (value: any) => {
  return validateArn(value) || 'Invalid Amazon Resource Name';
};

export function IsArn(validationOptions?: { allowEmptyString?: boolean }) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isArn',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: (args) =>
          validationOptions?.allowEmptyString && args.value === ''
            ? ''
            : (validate(args.value) as string),
      },
      validator: {
        validate: (value) =>
          (validationOptions?.allowEmptyString && value === '') || validate(value) === true
            ? true
            : false,
      },
    });
  };
}
