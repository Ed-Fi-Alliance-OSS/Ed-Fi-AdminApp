import {
  CERT_REVIEW_DECISION,
  CertReviewDecision,
  GetSessionDataDto,
  PostCertificationReviewDecisionDto,
} from '@edanalytics/models';
import { Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authorize } from '../auth/authorization';
import { ReqUser } from '../auth/helpers/user.decorator';
import { CertificationReviewService } from './certification-review.service';

/** Every review route, reads included, needs the global `certification:review` privilege. */
const REVIEW = { privilege: 'certification:review', subject: { id: '__filtered__' } } as const;

/** Global (not tenant-scoped) review routes for global admins, so no tenant interceptor. */
@ApiTags('Certification')
@Controller('certification/runs/:runId')
export class CertificationReviewController {
  constructor(private readonly reviewService: CertificationReviewService) {}

  @Post('pick-up')
  @HttpCode(200)
  @Authorize(REVIEW)
  pickUp(@Param('runId', ParseIntPipe) runId: number, @ReqUser() session?: GetSessionDataDto) {
    return this.reviewService.pickUp(runId, session?.id ?? null);
  }

  @Get('review')
  @Authorize(REVIEW)
  getReview(@Param('runId', ParseIntPipe) runId: number) {
    return this.reviewService.getReview(runId);
  }

  @Get('step-runs/:stepId/snapshot')
  @Header('Cache-Control', 'no-store')
  @Authorize(REVIEW)
  getSnapshot(
    @Param('runId', ParseIntPipe) runId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    return this.reviewService.getSnapshot(runId, stepId);
  }

  @Post('approve')
  @HttpCode(200)
  @Authorize(REVIEW)
  approve(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() body: PostCertificationReviewDecisionDto,
    @ReqUser() session?: GetSessionDataDto,
  ) {
    return this.decide(runId, CERT_REVIEW_DECISION.APPROVED, body, session);
  }

  @Post('reject')
  @HttpCode(200)
  @Authorize(REVIEW)
  reject(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() body: PostCertificationReviewDecisionDto,
    @ReqUser() session?: GetSessionDataDto,
  ) {
    return this.decide(runId, CERT_REVIEW_DECISION.REJECTED, body, session);
  }

  @Post('request-changes')
  @HttpCode(200)
  @Authorize(REVIEW)
  requestChanges(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() body: PostCertificationReviewDecisionDto,
    @ReqUser() session?: GetSessionDataDto,
  ) {
    return this.decide(runId, CERT_REVIEW_DECISION.CHANGES_REQUESTED, body, session);
  }

  private decide(
    runId: number,
    decision: CertReviewDecision,
    body: PostCertificationReviewDecisionDto,
    session?: GetSessionDataDto,
  ) {
    return this.reviewService.decide({
      runId,
      decision,
      comment: body.comment,
      userId: session?.id ?? null,
    });
  }
}
