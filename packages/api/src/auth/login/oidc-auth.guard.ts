import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
@Injectable()
export class OidcAuthGuard extends AuthGuard('oidc') {
  async canActivate(context: ExecutionContext) {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return result;
  }
  getAuthenticateOptions(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const query = request.query;
    return {
      state: query.redirect
    }
  }

}
