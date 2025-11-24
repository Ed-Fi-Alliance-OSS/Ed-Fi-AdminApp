import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../authorization/public.decorator';
import config from 'config';
import { JWTPayload } from 'jose';
import { User } from '@edanalytics/models-server';

type Auth0Payload = JWTPayload & {
  aud: string;
  azp: string;
  gty: string;
  scope: string;
  preferred_username: string;
  client_id: string;
};

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) { }
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
      try {
        const user = await this.authService.findActiveUserById(request.user.id);

        if (!user || !user.isActive) {
          Logger.warn(`User ${request.user.username} no longer valid - logging out`);
          // Destroy the session safely
          if (request.session && typeof request.session.destroy === 'function') {
            await new Promise<void>((resolve) => {
              request.session.destroy((err) => {
                if (err) Logger.error('Error destroying session:', err);
                resolve();
              });
            });
          }
          // Send 401 response to trigger frontend logout
          throw new HttpException(
            {
              statusCode: HttpStatus.UNAUTHORIZED,
              message: 'Session invalid - user no longer active',
              error: 'Unauthorized'
            },
            HttpStatus.UNAUTHORIZED
          );
        }

        request.user = user;

        return true;
      } catch (err) {
        Logger.error('User validation failed:', err);

        // Destroy the session safely
        if (request.session && typeof request.session.destroy === 'function') {
          await new Promise<void>((resolve) => {
            request.session.destroy((err) => {
              if (err) Logger.error('Error destroying session:', err);
              resolve();
            });
          });
        }

        // If it's already an HttpException, re-throw it
        if (err instanceof HttpException) {
          throw err;
        }

        // Otherwise, throw a new 401
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: 'Authentication failed',
            error: 'Unauthorized'
          },
          HttpStatus.UNAUTHORIZED
        );
      }
    } else {
      // JWT validation logic remains the same...
      const token = this.extractTokenFromHeader(request);
      const verifyResult = await this.authService.verifyBearerJwt(token);

      const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
      if (!AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE) {
        throw new Error('AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE is not defined');
      }

      if (verifyResult.status !== 'success') {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: verifyResult.message || 'Unauthorized',
            error: 'Unauthorized'
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      const { data } = verifyResult;
      const { aud: audience, azp: clientId, scope, preferred_username: username, client_id: machineClientId } = data as Auth0Payload;

      // Determine if it's a machine client token
      const isMachineClient = !!machineClientId || (audience === AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE && !username);

      let user: User;
      try {
        if (isMachineClient) {
          if (audience !== AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE || !scope?.includes('login:app')) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
          }
          user = await this.authService.validateUser({ clientId: machineClientId });
        } else {
          Logger.verbose(`Authenticating user: ${username}`);
          if (!username || audience !== 'account') {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
          }
          // User token: pass username and clientId for validation
          user = await this.authService.validateUser({ username, clientId });
        }
        if (user && user.isActive) {
          request.user = user;
          return true;
        } else {
          throw new HttpException('User not found or inactive', HttpStatus.UNAUTHORIZED);
        }
      } catch (error) {
        Logger.error('Machine user validation failed:', error);
        throw new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED);
      }
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
