import {
  Controller,
  Get,
  Header,
  ImATeapotException,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import config from 'config';
import { Public } from '../auth/authorization/public.decorator';
import { ErrorResponse } from '../utils/DefaultRouteError';

@ApiTags('App')
@Controller()
export class AppController {
  @Public()
  @Get('healthcheck')
  @ErrorResponse(new ImATeapotException('ts'))
  healthcheck() {
    return "Feelin' great!";
  }
  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('secret/:secretId')
  @ErrorResponse(new NotFoundException())
  secret(@Param('secretId') secretId: string) {
    return axios
      .get(`${config.YOPASS_URL}/secret/${secretId}`)
      .then((res) => {
        return res.data;
      })
      .catch((err) => {
        Logger.warn(err);
        throw new NotFoundException('Secret not found.');
      });
  }
}
