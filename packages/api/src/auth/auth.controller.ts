import {
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';

import { toGetSessionDataDto } from '@edanalytics/models';
import { LocalAuthGuard } from './local-auth.guard';
import { OidcAuthGuard } from './oidc-auth.guard';
import { Public } from './public.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

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
    res.redirect(`http://localhost:4200${req.query.state || ''}`);
  }

  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('/local/login')
  async login(@Request() req) {
    return toGetSessionDataDto(req.user);
  }

  @Get('me')
  async me(@Request() req) {
    return toGetSessionDataDto(req.user);
  }


  @Post('/logout')
  async logout(@Request() req, @Res() res: Response) {
    req.session.destroy(async () => {
      res.redirect('/')
    })
  }
}