import { subject } from '@casl/ability';
import { AuthorizationCache } from '@edanalytics/models';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { AUTHORIZE_KEY, AuthorizeMetadata } from './authorize.decorator';
import { abilityFromCache } from './helpers';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthorizedGuard implements CanActivate {
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
    if (request.isAuthenticated()) {
      const authorizationCache: AuthorizationCache = request['authorizationCache'];

      const tenantIdStr = request.params?.tenantId;
      try {
        const ability = abilityFromCache(authorizationCache, tenantIdStr);

        request['abilities'] = ability;

        const authorizeRule = this.reflector.getAllAndOverride<
          AuthorizeMetadata | undefined | null
        >(AUTHORIZE_KEY, [context.getHandler(), context.getClass()]);

        if (authorizeRule === undefined) {
          // Each route _must_ define its authorization rule or skip authorization _explicitly_.
          Logger.error('Authorization rule not defined for route' + request.url);
          return false;
        } else if (authorizeRule === null) {
          Logger.verbose('Authorization explicitly skipped for route' + request.url);
        } else {
          /* eslint-disable-next-line */
          function checkAbility(authorizeRule: AuthorizeMetadata) {
            const privilege = authorizeRule.privilege;
            const subjectTemplate = authorizeRule.subject;

            let subjectTenant = {};
            if ('tenantId' in subjectTemplate) {
              const value = request.params[subjectTemplate.tenantId];
              if (value === undefined) {
                throw new Error(
                  'Attempting to authorize by tenant but no tenantId found in request.'
                );
              }
              subjectTenant = {
                tenantId: value,
              };
            }

            let subjectSbe = {};
            if ('sbeId' in subjectTemplate) {
              const value = request.params[subjectTemplate.sbeId];
              if (value === undefined) {
                throw new Error('Attempting to authorize by sbe but no sbeId found in request.');
              }
              subjectSbe = {
                sbeId: value,
              };
            }

            let subjectId = undefined;
            if (subjectTemplate.id === '__filtered__') {
              subjectId = '__filtered__';
            } else {
              const value = request.params[subjectTemplate.id];
              if (value === undefined) {
                throw new Error('Attempting to authorize by Id but no Id found in request.');
              }
              subjectId = value;
            }
            const subjectObject: AuthorizeMetadata['subject'] = {
              ...subjectTenant,
              ...subjectSbe,
              id: subjectId,
            };
            subject(privilege, subjectObject);
            const authorizationResult = ability.can(privilege, subjectObject);
            return authorizationResult;
          }
          request['checkAbility'] = checkAbility;
          const authorizationResult = checkAbility(authorizeRule);
          if (!authorizationResult) {
            throw new HttpException('Unauthorized', 403);
          }
        }
      } catch (authorizationSystemError) {
        Logger.log(authorizationSystemError);
        return false;
      }

      return true;
    } else {
      return false;
    }
  }
}
