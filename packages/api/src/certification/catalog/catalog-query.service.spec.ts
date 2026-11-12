import { Repository } from 'typeorm';
import {
  DomainCatalog,
  CatalogVersion,
  ScenarioCatalog,
  StepCatalog,
  StepParameterCatalog,
} from '@edanalytics/models-server';
import { CatalogQueryService } from './catalog-query.service';

const mockRepo = <T>(rows: Partial<T>[] = []) =>
  ({ find: jest.fn().mockResolvedValue(rows) }) as unknown as jest.Mocked<Repository<T>>;

const domain = (domainId: number, catalogVersionId = 1): Partial<DomainCatalog> => ({
  domainId,
  catalogVersionId,
  name: `Domain${domainId}`,
  displayName: `Domain ${domainId}`,
  displayOrder: domainId,
  isEnabled: true,
});

const scenario = (scenarioId: number, domainId: number): Partial<ScenarioCatalog> => ({
  scenarioId,
  domainId,
  name: `Scenario${scenarioId}`,
  displayName: `Scenario ${scenarioId}`,
  displayOrder: scenarioId,
  isEnabled: true,
});

const step = (stepId: number, scenarioId: number): Partial<StepCatalog> => ({
  stepId,
  scenarioId,
  stepName: `Step${stepId}`,
  displayName: `Step ${stepId}`,
  stepType: 'CREATE',
  displayOrder: stepId,
  isEnabled: true,
});

const parameter = (parameterId: number, stepId: number): Partial<StepParameterCatalog> => ({
  parameterId,
  stepId,
  type: 'input',
  name: `param${parameterId}`,
  description: null,
});

const build = (repos: {
  versions?: Partial<CatalogVersion>[];
  domains?: Partial<DomainCatalog>[];
  scenarios?: Partial<ScenarioCatalog>[];
  steps?: Partial<StepCatalog>[];
  parameters?: Partial<StepParameterCatalog>[];
}) => {
  const versionRepo = mockRepo<CatalogVersion>(repos.versions);
  const domainRepo = mockRepo<DomainCatalog>(repos.domains);
  const scenarioRepo = mockRepo<ScenarioCatalog>(repos.scenarios);
  const stepRepo = mockRepo<StepCatalog>(repos.steps);
  const parameterRepo = mockRepo<StepParameterCatalog>(repos.parameters);
  const service = new CatalogQueryService(
    versionRepo,
    domainRepo,
    scenarioRepo,
    stepRepo,
    parameterRepo,
  );
  return { service, versionRepo, domainRepo, scenarioRepo, stepRepo, parameterRepo };
};

describe('CatalogQueryService', () => {
  describe('findCatalogVersions', () => {
    it('returns every catalog version, newest first', async () => {
      const versions = [{ catalogVersionId: 2 }, { catalogVersionId: 1 }];
      const { service, versionRepo } = build({ versions });

      await expect(service.findCatalogVersions()).resolves.toEqual(versions);
      expect(versionRepo.find).toHaveBeenCalledWith({ order: { catalogVersionId: 'DESC' } });
    });
  });

  describe('findDomainsWithScenarios', () => {
    it('groups enabled scenarios under their domain, preserving order', async () => {
      const { service } = build({
        domains: [domain(1), domain(2)],
        scenarios: [scenario(10, 1), scenario(20, 2), scenario(11, 1)],
      });

      const result = await service.findDomainsWithScenarios(1);

      expect(result.map((a) => a.domainId)).toEqual([1, 2]);
      expect(result[0].scenarios.map((s) => s.scenarioId)).toEqual([10, 11]);
      expect(result[1].scenarios.map((s) => s.scenarioId)).toEqual([20]);
    });

    it('filters domains and scenarios by catalogVersionId and isEnabled when given', async () => {
      const { service, domainRepo, scenarioRepo } = build({ domains: [domain(1)] });

      await service.findDomainsWithScenarios(5);

      expect(domainRepo.find).toHaveBeenCalledWith({
        where: { isEnabled: true, catalogVersionId: 5 },
        order: { displayOrder: 'ASC', domainId: 'ASC' },
      });
      expect(scenarioRepo.find).toHaveBeenCalledWith({
        where: { isEnabled: true, domain: { isEnabled: true, catalogVersionId: 5 } },
        order: { displayOrder: 'ASC', scenarioId: 'ASC' },
      });
    });

    it('does not filter by catalog version when catalogVersionId is omitted', async () => {
      const { service, domainRepo, scenarioRepo } = build({ domains: [domain(1, 1), domain(2, 2)] });

      await service.findDomainsWithScenarios();

      expect(domainRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isEnabled: true } }),
      );
      expect(scenarioRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isEnabled: true, domain: { isEnabled: true } } }),
      );
    });

    it('returns a domain with no scenarios as an empty list', async () => {
      const { service } = build({ domains: [domain(1)], scenarios: [] });

      const result = await service.findDomainsWithScenarios(1);

      expect(result).toEqual([expect.objectContaining({ domainId: 1, scenarios: [] })]);
    });

    it('returns an empty list and skips the scenario query when no domains match', async () => {
      const { service, scenarioRepo } = build({ domains: [] });

      await expect(service.findDomainsWithScenarios(999)).resolves.toEqual([]);
      expect(scenarioRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findStepsWithParameters', () => {
    it('attaches each step its parameters, preserving order', async () => {
      const { service } = build({
        steps: [step(1, 7), step(2, 7)],
        parameters: [parameter(100, 1), parameter(200, 2), parameter(101, 1)],
      });

      const result = await service.findStepsWithParameters(7);

      expect(result.map((s) => s.stepId)).toEqual([1, 2]);
      expect(result[0].parameters.map((p) => p.parameterId)).toEqual([100, 101]);
      expect(result[1].parameters.map((p) => p.parameterId)).toEqual([200]);
    });

    it('filters steps and parameters by scenarioId and the enabled hierarchy when given', async () => {
      const { service, stepRepo, parameterRepo } = build({ steps: [step(1, 7)] });

      await service.findStepsWithParameters(7);

      const enabledParents = { isEnabled: true, domain: { isEnabled: true } };
      expect(stepRepo.find).toHaveBeenCalledWith({
        where: { isEnabled: true, scenarioId: 7, scenario: enabledParents },
        order: { displayOrder: 'ASC', stepId: 'ASC' },
      });
      expect(parameterRepo.find).toHaveBeenCalledWith({
        where: { step: { isEnabled: true, scenarioId: 7, scenario: enabledParents } },
        order: { parameterId: 'ASC' },
      });
    });

    it('does not filter by scenario when scenarioId is omitted', async () => {
      const { service, stepRepo } = build({ steps: [step(1, 7), step(2, 8)] });

      const result = await service.findStepsWithParameters();

      expect(stepRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isEnabled: true,
            scenario: { isEnabled: true, domain: { isEnabled: true } },
          },
        }),
      );
      expect(result.map((s) => s.stepId)).toEqual([1, 2]);
    });

    it('returns an empty list and skips the parameter query when no steps match', async () => {
      const { service, parameterRepo } = build({ steps: [] });

      await expect(service.findStepsWithParameters(999)).resolves.toEqual([]);
      expect(parameterRepo.find).not.toHaveBeenCalled();
    });
  });
});
