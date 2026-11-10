import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DomainCatalog,
  CatalogVersion,
  ScenarioCatalog,
  StepCatalog,
  StepParameterCatalog,
} from '@edanalytics/models-server';

export type DomainWithScenarios = DomainCatalog & { scenarios: ScenarioCatalog[] };
export type StepWithParameters = StepCatalog & { parameters: StepParameterCatalog[] };

/**
 * Read-only queries over the certification catalog synced by CatalogService.
 * Disabled domains, scenarios and steps (and anything beneath them) are excluded.
 * Children are filtered through their parent relations rather than an `IN (...)`
 * list of ids, so an unfiltered request stays within MSSQL's parameter limit.
 */
@Injectable()
export class CatalogQueryService {
  constructor(
    @InjectRepository(CatalogVersion)
    private readonly catalogVersionRepo: Repository<CatalogVersion>,
    @InjectRepository(DomainCatalog)
    private readonly domainRepo: Repository<DomainCatalog>,
    @InjectRepository(ScenarioCatalog)
    private readonly scenarioRepo: Repository<ScenarioCatalog>,
    @InjectRepository(StepCatalog)
    private readonly stepRepo: Repository<StepCatalog>,
    @InjectRepository(StepParameterCatalog)
    private readonly parameterRepo: Repository<StepParameterCatalog>,
  ) {}

  findCatalogVersions(): Promise<CatalogVersion[]> {
    return this.catalogVersionRepo.find({ order: { catalogVersionId: 'DESC' } });
  }

  async findDomainsWithScenarios(catalogVersionId?: number): Promise<DomainWithScenarios[]> {
    const domainWhere = {
      isEnabled: true,
      ...(catalogVersionId !== undefined && { catalogVersionId }),
    };

    const domains = await this.domainRepo.find({
      where: domainWhere,
      order: { displayOrder: 'ASC', domainId: 'ASC' },
    });
    if (domains.length === 0) return [];

    const scenarios = await this.scenarioRepo.find({
      where: { isEnabled: true, domain: domainWhere },
      order: { displayOrder: 'ASC', scenarioId: 'ASC' },
    });

    const byDomain = groupBy(scenarios, (s) => s.domainId);
    return domains.map((domain) => ({ ...domain, scenarios: byDomain.get(domain.domainId) ?? [] }));
  }

  async findStepsWithParameters(scenarioId?: number): Promise<StepWithParameters[]> {
    const stepWhere = {
      isEnabled: true,
      ...(scenarioId !== undefined && { scenarioId }),
      scenario: { isEnabled: true, domain: { isEnabled: true } },
    };

    const steps = await this.stepRepo.find({
      where: stepWhere,
      order: { displayOrder: 'ASC', stepId: 'ASC' },
    });
    if (steps.length === 0) return [];

    const parameters = await this.parameterRepo.find({
      where: { step: stepWhere },
      order: { parameterId: 'ASC' },
    });

    const byStep = groupBy(parameters, (p) => p.stepId);
    return steps.map((step) => ({ ...step, parameters: byStep.get(step.stepId) ?? [] }));
  }
}

const groupBy = <T>(rows: T[], key: (row: T) => number): Map<number, T[]> => {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
};
