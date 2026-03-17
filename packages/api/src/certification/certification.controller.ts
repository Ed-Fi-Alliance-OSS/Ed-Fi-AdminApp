import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/authorization/public.decorator';
import { CertificationService } from './certification.service';

interface RunDto {
  scenarioPath: string; // path relative to runtime bruno root, e.g. v4/Group/Entity
  params?: Record<string, any>;
  env?: string;
}

@Controller('certification')
export class CertificationController {
  constructor(private readonly certService: CertificationService) {}

  @Post('run')
  @Public()
  async run(@Body() body: RunDto) {

    // ------------------------------------------------------------------------------
    // @TODO: The run() method was copied from the original POC and will be refactored in Certification 2.2
    // ------------------------------------------------------------------------------

    if (!body || !body.scenarioPath) {
      return { error: 'scenarioPath required' };
    }

    // Ensure runtime exists (without destructive refresh on every request)
    await this.certService.ensureRuntimeReady();

    const workDir = await this.certService.prepareScenario(body.scenarioPath, body.params || {});
    const result = await this.certService.runBruno(workDir, body.env);
    return {
      scenarioPath: body.scenarioPath,
      workDir,
      exitCode: result.exitCode,
      output: result.output,
    };
  }
}
