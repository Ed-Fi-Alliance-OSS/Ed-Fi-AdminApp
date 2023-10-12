import { Sbe } from '@edanalytics/models-server';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  createParamDecorator,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { Repository } from 'typeorm';
import { throwNotFound } from '../../utils';

/** Look up SBE identified in route path and attach it to request object */
@Injectable()
export class TenantSbeInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    const tenantId = Number(request.params?.tenantId);
    const sbeId = Number(request.params?.sbeId);

    if (!(_.isFinite(tenantId) && _.isFinite(sbeId))) {
      throw new Error('Invalid tenantId or sbeId in SbeInterceptor context.');
    }

    const sbe = await this.sbesRepository.findOneByOrFail({ id: sbeId }).catch(throwNotFound);

    request.sbe = sbe;
    return next.handle();
  }
}

/** Inject Sbe from request object into a handler param */
export const ReqSbe = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  if (!(request?.sbe?.constructor?.name === 'Sbe')) {
    throw new Error("No Sbe found in request's context in ReqSbe.");
  }
  return request.sbe;
});
