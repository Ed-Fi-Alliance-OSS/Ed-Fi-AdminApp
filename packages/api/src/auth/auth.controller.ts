import {
  AuthorizationCache,
  GetSessionDataDto,
  Ids,
  PrivilegeCode,
  isGlobalPrivilege,
  isSbePrivilege,
  toGetSessionDataDto,
  toGetTenantDto,
} from '@edanalytics/models';
import { Tenant } from '@edanalytics/models-server';
import {
  Controller,
  Get,
  Header,
  Logger,
  Next,
  Param,
  Post,
  Query,
  Req,
  Request,
  Res,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import config from 'config';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import passport from 'passport';
import { Repository } from 'typeorm';
import { Authorize, NoAuthorization } from './authorization';
import { Public } from './authorization/public.decorator';
import { AuthCache } from './helpers/inject-auth-cache';
import { ReqUser } from './helpers/user.decorator';
import { IdpService } from './idp.service';
import { NO_ROLE, USER_NOT_FOUND } from './login/oidc.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    private readonly idpService: IdpService
  ) {}

  @Public()
  @Get('/oidc/:oidcId/login')
  oidcLogin(@Param('oidcId') oidcId: number, @Res() res: Response, @Request() req, @Next() next) {
    passport.authenticate(`oidc-${oidcId}`, {
      state: JSON.stringify({
        redirect: req.query?.redirect ?? '/',
        random: randomUUID(),
      }),
    })(req, res, next);
  }

  @Public()
  @Get('/oidc/:oidcId/callback')
  oidcLoginCallback(
    @Param('oidcId') oidcId: number,
    @Res() res: Response,
    @Request() req,
    @Next() next
  ) {
    let redirect = '/';
    try {
      redirect = JSON.parse(req.query.state).redirect;
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
  async me(@ReqUser() session: GetSessionDataDto, @Req() req) {
    return toGetSessionDataDto(session);
  }
  @Get('my-tenants')
  @NoAuthorization()
  @Header('Cache-Control', 'no-store')
  async myTenants(
    @ReqUser() session: GetSessionDataDto,
    @AuthCache() privileges: AuthorizationCache,
    @Req() req
  ) {
    if (privileges['tenant:read'] === true) {
      return toGetTenantDto(await this.tenantsRepository.find());
    } else {
      return toGetTenantDto(session?.userTenantMemberships?.map((utm) => utm.tenant) ?? []);
    }
  }
  @Get('authorizations/:privilege/:tenantId?')
  @Authorize({
    privilege: 'me:read',
    subject: {
      id: '__filtered__',
    },
  })
  async privilegeCache(
    @Param('privilege') privilege: PrivilegeCode,
    @Param('tenantId') tenantId: string | undefined,
    @Query('sbeId') sbeId: string | undefined,
    @AuthCache() cache: AuthorizationCache
  ) {
    let result: Ids | false | undefined = false;
    if (tenantId === undefined && isGlobalPrivilege(privilege)) {
      result = cache?.[privilege];
    } else if (tenantId !== undefined && !isGlobalPrivilege(privilege)) {
      if (sbeId === undefined && !isSbePrivilege(privilege)) {
        result = cache?.[privilege];
      } else if (sbeId !== undefined && isSbePrivilege(privilege)) {
        result = cache?.[privilege]?.[sbeId];
      }
    }
    return result === true ? true : result === false || result === undefined ? false : [...result];
  }

  @Post('/logout')
  @Public()
  async logout(@Request() req /* @Res() res: Response */) {
    return req.session.destroy(async () => {
      return undefined;
    });
  }
}
