import 'reflect-metadata';
import { In, IsNull } from 'typeorm';
import { ValidationHttpException } from '../utils';
import { CertificationStepRunsService } from './certification-step-runs.service';

describe('CertificationStepRunsService.findStepRuns', () => {
  let scenarioRepository: { findOne: jest.Mock };
  let processRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let processScenarioRepository: { findOne: jest.Mock };
  let stepRunRepository: { find: jest.Mock };
  let stepErrorRepository: { find: jest.Mock };
  let service: CertificationStepRunsService;

  const find = (
    overrides: Partial<Parameters<CertificationStepRunsService['findStepRuns']>[0]> = {},
  ) =>
    service.findStepRuns({
      edfiTenantId: 10,
      odsId: 5,
      sisVersion: 'v5',
      scenarioId: 20,
      ...overrides,
    });

  beforeEach(() => {
    scenarioRepository = {
      findOne: jest.fn().mockResolvedValue({
        scenarioId: 20,
        area: {
          catalogVersionId: 3,
          catalogVersion: { catalogVersionId: 3, dataStandardVersion: 'v5' },
        },
      }),
    };
    processRepository = {
      findOne: jest.fn().mockResolvedValue({ certificationProcessId: 7 }),
      create: jest.fn(),
      save: jest.fn(),
    };
    processScenarioRepository = { findOne: jest.fn().mockResolvedValue({ status: 'failed' }) };
    stepRunRepository = { find: jest.fn().mockResolvedValue([]) };
    stepErrorRepository = { find: jest.fn().mockResolvedValue([]) };
    service = new CertificationStepRunsService(
      scenarioRepository as never,
      processRepository as never,
      processScenarioRepository as never,
      stepRunRepository as never,
      stepErrorRepository as never,
    );
  });

  it("keys the process on the requested scenario's catalog version, the same one runStep uses", async () => {
    await find();

    expect(scenarioRepository.findOne).toHaveBeenCalledWith({
      where: { scenarioId: 20 },
      relations: { area: { catalogVersion: true } },
    });
    expect(processRepository.findOne).toHaveBeenCalledWith({
      where: { edfiTenantId: 10, odsId: 5, catalogVersionId: 3 },
    });
  });

  it('returns no steps when the scenario does not exist', async () => {
    scenarioRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(processRepository.findOne).not.toHaveBeenCalled();
  });

  it("returns no steps when the scenario belongs to another SIS version's catalog", async () => {
    scenarioRepository.findOne.mockResolvedValue({
      scenarioId: 20,
      area: {
        catalogVersionId: 9,
        catalogVersion: { catalogVersionId: 9, dataStandardVersion: 'v4' },
      },
    });

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(processRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns no steps when the process does not exist, without creating one', async () => {
    processRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(processRepository.create).not.toHaveBeenCalled();
    expect(processRepository.save).not.toHaveBeenCalled();
    expect(stepRunRepository.find).not.toHaveBeenCalled();
  });

  it('looks the process up with IsNull() when no ODS is chosen', async () => {
    await find({ odsId: null });

    expect(processRepository.findOne).toHaveBeenCalledWith({
      where: { edfiTenantId: 10, odsId: IsNull(), catalogVersionId: 3 },
    });
  });

  it('looks the process up by the chosen ODS', async () => {
    await find();

    expect(processRepository.findOne).toHaveBeenCalledWith({
      where: { edfiTenantId: 10, odsId: 5, catalogVersionId: 3 },
    });
  });

  it('returns saved steps with inputs, ISO ranAt and mapped errors', async () => {
    stepRunRepository.find.mockResolvedValue([
      {
        stepRunId: 55,
        stepId: 101,
        status: 'failed',
        runAt: new Date('2026-10-15T15:00:00.000Z'),
        inputs: { studentUniqueId: 'S1' },
      },
      {
        stepRunId: 56,
        stepId: 102,
        status: 'success',
        runAt: new Date('2026-10-15T15:05:00.000Z'),
        inputs: null,
      },
    ]);
    stepErrorRepository.find.mockResolvedValue([
      {
        stepRunId: 55,
        property: 'res.status',
        validation: 'eq 200',
        description: 'expected 500 to equal 200',
      },
      { stepRunId: 55, property: null, validation: null, description: null },
    ]);

    await expect(find()).resolves.toEqual({
      scenarioStatus: 'failed',
      steps: [
        {
          stepId: 101,
          status: 'failed',
          ranAt: '2026-10-15T15:00:00.000Z',
          inputs: { studentUniqueId: 'S1' },
          errors: [
            { property: 'res.status', validation: 'eq 200', error: 'expected 500 to equal 200' },
            { property: '', validation: '', error: '' },
          ],
        },
        {
          stepId: 102,
          status: 'success',
          ranAt: '2026-10-15T15:05:00.000Z',
          inputs: null,
          errors: [],
        },
      ],
    });
    expect(stepRunRepository.find).toHaveBeenCalledWith({
      where: { certificationProcessId: 7, scenarioId: 20 },
    });
    expect(stepErrorRepository.find).toHaveBeenCalledWith({
      where: { stepRunId: In([55, 56]) },
      order: { errorId: 'ASC' },
    });
    expect(processScenarioRepository.findOne).toHaveBeenCalledWith({
      where: { certificationProcessId: 7, scenarioId: 20 },
    });
  });

  it('returns a null scenario status and skips the error lookup when no step of the scenario ran', async () => {
    processScenarioRepository.findOne.mockResolvedValue(null);

    await expect(find()).resolves.toEqual({ scenarioStatus: null, steps: [] });
    expect(stepErrorRepository.find).not.toHaveBeenCalled();
  });

  it('rejects an unsupported SIS version', async () => {
    await expect(find({ sisVersion: 'v4' })).rejects.toBeInstanceOf(ValidationHttpException);
    expect(scenarioRepository.findOne).not.toHaveBeenCalled();
  });
});
