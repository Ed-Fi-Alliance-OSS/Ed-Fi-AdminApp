import {
  CERT_REVIEW_QUEUE_STATUSES,
  CERT_RUN_STATUS,
  CertificationDashboardListDto,
} from '@edanalytics/models';
import { CertificationRun } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toRow } from './certification-dashboard.service';

const WAITING_GROUP = 0;
const IN_REVIEW_GROUP = 1;
const OTHER_GROUP = 2;

const groupOf = (run: CertificationRun) => {
  if (CERT_REVIEW_QUEUE_STATUSES.includes(run.status)) return WAITING_GROUP;
  return run.status === CERT_RUN_STATUS.IN_REVIEW ? IN_REVIEW_GROUP : OTHER_GROUP;
};

const submissionTime = (run: CertificationRun) =>
  (run.submittedAt ?? run.statusChangedAt).getTime();

const compareRuns = (a: CertificationRun, b: CertificationRun) => {
  const groupDifference = groupOf(a) - groupOf(b);
  if (groupDifference !== 0) return groupDifference;
  const timeDifference =
    groupOf(a) === OTHER_GROUP
      ? b.updatedAt.getTime() - a.updatedAt.getTime()
      : submissionTime(a) - submissionTime(b);
  return timeDifference !== 0 ? timeDifference : a.certificationRunId - b.certificationRunId;
};

/** Every certification run across all teams, for the global review queue. */
@Injectable()
export class CertificationRunListService {
  constructor(
    @InjectRepository(CertificationRun)
    private readonly runRepository: Repository<CertificationRun>,
  ) {}

  /** Waiting runs first, oldest submission first, then runs in review, then the rest newest first. */
  async getRuns(): Promise<CertificationDashboardListDto> {
    const runs = await this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.team', 'team')
      .leftJoinAndSelect('run.edfiTenant', 'edfiTenant')
      .leftJoinAndSelect('edfiTenant.sbEnvironment', 'sbEnvironment')
      .leftJoinAndSelect('run.ods', 'ods')
      .getMany();
    const rows = runs.sort(compareRuns).map(toRow);
    return { rows, total: rows.length };
  }
}
