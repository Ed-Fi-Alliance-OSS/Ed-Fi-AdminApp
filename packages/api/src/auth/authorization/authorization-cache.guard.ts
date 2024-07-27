import { AuthorizationCache, ITeamCache, isGlobalPrivilege } from '@edanalytics/models';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthCacheGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}
  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();

    /** Union of:
     * - user's global-type rights, and
     * - intersection of team's rights and user's team-type rights
     *
     * So if a user has a global privilege (e.g. edfiTenant.edorg:read), then
     * they can use it. If they have a team privilege (e.g.
     * team.sb-environment.edfi-tenant.ods.edorg:read), they can only use it if the team
     * itself also has that privilege on the relevant resource.
     */
    const authorizationCache: AuthorizationCache = {};
    const teamIdStr = request.params?.teamId;

    const userPrivileges = await this.authService.getUserPrivileges(
      request.user.id,
      teamIdStr === undefined ? undefined : Number(teamIdStr)
    );
    userPrivileges.forEach((userPrivilege) => {
      if (isGlobalPrivilege(userPrivilege)) {
        authorizationCache[userPrivilege] = true;
      }
    });

    if (typeof teamIdStr === 'string') {
      const teamId = Number(teamIdStr);
      const teamCache = await this.authService.getTeamOwnershipCache(teamId);
      Object.keys(teamCache).forEach((k: keyof ITeamCache) => {
        if (userPrivileges.has(k)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          authorizationCache[k] = teamCache[k] as any;
        }
      });
    }
    request['authorizationCache'] = authorizationCache;

    return true;
  }
}
