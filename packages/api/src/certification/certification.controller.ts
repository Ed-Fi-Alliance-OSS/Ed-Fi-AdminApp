import { Body, Controller, Post } from '@nestjs/common';
import { CertificationService } from './certification.service';
import { ScenarioRunnerDto } from './certification.dto';
import { Public } from '../auth/authorization/public.decorator';

@Controller('certification')
export class CertificationController {
  constructor(private readonly runner: CertificationService) {}

  // @Public() must be replaced with appropriate auth guard in production, added here for ease of testing with Powershell examples included in this module
  @Post('run-scenario')
  @Public()
  async runScenario(@Body() body: ScenarioRunnerDto) {
    const { scriptPath, params, auth } = body as any;
    const result = await this.runner.run(scriptPath, params, auth);
    return result;
  }
}
