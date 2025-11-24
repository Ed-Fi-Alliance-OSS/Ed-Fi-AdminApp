import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthorizeMetadata } from './authorize.decorator';

export const CheckAbility = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.checkAbility as (authorizeRule: AuthorizeMetadata) => boolean;
});

export type CheckAbilityType = (authorizeRule: AuthorizeMetadata) => boolean;
