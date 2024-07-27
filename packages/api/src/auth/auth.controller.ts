import {
  AuthorizationCache,
  GetSessionDataDto,
  PrivilegeCode,
  isBaseTeamPrivilege,
  isGlobalPrivilege,
  isCachedByEdfiTenant,
  toGetSessionDataDto,
  toGetTeamDto,
  isCachedBySbEnvironment,
} from '@edanalytics/models';
import { Team } from '@edanalytics/models-server';
import {
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Request as Req, // TODO: can Req just be used here?
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { randomUUID } from 'crypto';
import type { Response, Request } from 'express';
import passport from 'passport';
import { Repository } from 'typeorm';
import { Authorize, NoAuthorization } from './authorization';
import { Public } from './authorization/public.decorator';
import { AuthCache } from './helpers/inject-auth-cache';
import { ReqUser } from './helpers/user.decorator';
import { NO_ROLE, USER_NOT_FOUND } from './login/oidc.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>
  ) {}

  @Public()
  @Get('/login/:oidcId')
  oidcLogin(@Param('oidcId') oidcId: number, @Res() res: Response, @Req() req: Request) {
    passport.authenticate(`oidc-${oidcId}`, {
      state: JSON.stringify({
        redirect: req.query?.redirect ?? '/',
        random: randomUUID(),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })(req, res, (err: any) => {
      if (err?.message.includes('Unknown authentication strategy')) {
        throw new NotFoundException();
      } else {
        throw new InternalServerErrorException();
      }
    });
  }

  @Public()
  @Get('/callback/:oidcId')
  oidcLoginCallback(@Param('oidcId') oidcId: number, @Res() res: Response, @Req() req: Request) {
    let redirect = '/';
    try {
      redirect = JSON.parse(req.query.state as string).redirect;
    } catch (error) {
      // no redirect
    }
    passport.authenticate(`oidc-${oidcId}`, {
      successRedirect: `${config.FE_URL}${redirect}`,
      failureRedirect: `${config.FE_URL}/unauthenticated`,
    })(req, res, (err: Error) => {
      Logger.error(err);

      if (err.message === USER_NOT_FOUND) {
        res.redirect(
          `${config.FE_URL}/unauthenticated?msg=Oops, it looks like your user hasn't been created yet. We'll let you know when you can log in.`
        );
      } else if (err.message === NO_ROLE) {
        res.redirect(
          `${config.FE_URL}/unauthenticated?msg=Your login worked, but it looks like your setup isn't quite complete. We'll let you know when everything's ready.`
        );
      } else if (
        err.message?.startsWith('did not find expected authorization request details in session')
      ) {
        res.redirect(
          `${config.FE_URL}/unauthenticated?msg=Login failed. There may be an issue, but please try again.`
        );
      } else if (err.message?.startsWith('invalid_grant (Code not valid)')) {
        res.redirect(
          `${config.FE_URL}/unauthenticated?msg=It looks like there was a hiccup during login. Please try again.`
        );
      } else {
        res.redirect(
          `${config.FE_URL}/unauthenticated?msg=It looks like your login was not successful. Please try again and contact us if the issue persists.`
        );
      }
    });
  }

  @Get('me')
  @NoAuthorization()
  @Header('Cache-Control', 'no-store')
  async me(@ReqUser() session: GetSessionDataDto) {
    return toGetSessionDataDto(session);
  }
  @Get('my-teams')
  @NoAuthorization()
  @Header('Cache-Control', 'no-store')
  async myTeams(
    @ReqUser() session: GetSessionDataDto,
    @AuthCache() privileges: AuthorizationCache
  ) {
    if (privileges['team:read'] === true) {
      return toGetTeamDto(await this.teamsRepository.find());
    } else {
      return toGetTeamDto(session?.userTeamMemberships?.map((utm) => utm.team) ?? []);
    }
  }
  @Get('cache/:teamId?')
  @Authorize({
    privilege: 'me:read',
    subject: {
      id: '__filtered__',
    },
  })
  async privilegeCache(
    @Param('teamId') teamId: string | undefined,
    @Query('edfiTenantId') edfiTenantId: string | undefined,
    @Query('sbEnvironmentId') sbEnvironmentId: string | undefined,
    @AuthCache() cache: AuthorizationCache
  ) {
    const result: Partial<AuthorizationCache> = {};
    if (teamId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isGlobalPrivilege(privilege)) {
          result[privilege] = cache[privilege];
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId === undefined && edfiTenantId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isBaseTeamPrivilege(privilege)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result[privilege] = cache[privilege] as any;
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId !== undefined && edfiTenantId === undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isCachedBySbEnvironment(privilege) && sbEnvironmentId in cache[privilege]) {
          result[privilege] = cache[privilege][sbEnvironmentId];
        }
      });
    }
    if (teamId !== undefined && sbEnvironmentId === undefined && edfiTenantId !== undefined) {
      Object.keys(cache).forEach((privilege: PrivilegeCode) => {
        if (isCachedByEdfiTenant(privilege) && edfiTenantId in cache[privilege]) {
          result[privilege] = cache[privilege][edfiTenantId];
        }
      });
    }
    return result;
  }

  @Post('/logout')
  @Public()
  async logout(@Req() req: Request /* @Res() res: Response */) {
    return req.session.destroy(async () => {
      return undefined;
    });
  }
}
