import { Controller, Get, Header, Logger, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import config from 'config';
import { Public } from '../auth/authorization/public.decorator';

@ApiTags('App')
@Controller()
export class AppController {
  @Public()
  @Get('healthcheck')
  healthcheck() {
    return "Feelin' great!";
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('secret/:secretId/')
  secret(@Param('secretId') secretId: number) {
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
