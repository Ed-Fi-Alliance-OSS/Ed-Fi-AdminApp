import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthCache = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.authorizationCache;
});
