import {
  Controller, Get, ImATeapotException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/authorization/public.decorator';
import { ErrorResponse } from '../utils/DefaultRouteError';

@ApiTags('App')
@Controller()
export class AppController {

  @Public()
  @Get('healthcheck')
  @ErrorResponse(new ImATeapotException('ts'))
  healthcheck() {
    return "Feelin' great!"
  }
}

