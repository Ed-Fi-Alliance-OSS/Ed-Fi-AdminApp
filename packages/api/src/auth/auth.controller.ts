import {
  Controller,
  Get,
  Post,
  Redirect,
  Request,
  Res,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';

import { toGetSessionDataDto } from '@edanalytics/models';
import { LocalAuthGuard } from './login/local-auth.guard';
import { OidcAuthGuard } from './login/oidc-auth.guard';
import { Public } from './authorization/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { environment } from '../environments/environment.local';
import { ApplauncherAuthGuard } from './login/applauncher-auth.guard';
import { ReqUser } from './helpers/user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

  @Public()
  @Get('/applauncher/login')
  @Redirect(environment.APPLAUNCHER_LOGIN_URL)
  applauncherLogin() {
    // let redirect decorator handle it
  }

  @UseGuards(ApplauncherAuthGuard)
  @Public()
  @Get('/applauncher/callback/:authResult')
  applauncherLoginCallback(@Res() res: Response, @Request() req) {
    res.redirect(`${environment.FE_URL}${req.query?.state || ''}`); // currently applauncher doesn't support redirect `state` but maybe it will eventually.
  }

  @UseGuards(OidcAuthGuard)
  @Public()
  @Get('/oidc/login')
  oidcLogin() {
    // let passport trigger redirect
  }

  @UseGuards(OidcAuthGuard)
  @Public()
  @Get('/oidc/callback')
  oidcLoginCallback(@Res() res: Response, @Request() req) {
    res.redirect(`${environment.FE_URL}${req.query?.state || ''}`);
  }

  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('/local/login')
  async login(@Request() req) {
    return toGetSessionDataDto(req.user);
  }

  @Get('me')
  async me(@ReqUser() user) {
    return toGetSessionDataDto(user);
  }

  @Post('/logout')
  async logout(@Request() req, @Res() res: Response) {
    req.session.destroy(async () => {
      res.redirect('/')
    })
  }
}