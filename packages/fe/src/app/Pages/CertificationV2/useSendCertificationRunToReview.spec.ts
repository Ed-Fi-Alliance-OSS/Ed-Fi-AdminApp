import 'reflect-metadata';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api-v2/apiClient';
import { certificationQueryKeys } from './useCertificationCatalog';
import { useSendCertificationRunToReview } from './useSendCertificationRunToReview';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock('../../api', () => ({ methods: {} }));
jest.mock('../../api-v2/apiClient', () => ({ apiClient: { post: jest.fn() } }));

describe('useSendCertificationRunToReview', () => {
  const invalidateQueries = jest.fn();
  const setQueryData = jest.fn();
  const options = () => (useMutation as jest.Mock).mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries, setQueryData });
    useSendCertificationRunToReview();
  });

  it("posts to the run's send-to-review under the team's tenant", async () => {
    const sent = { runId: 7, status: 'READY_FOR_REVIEW' };
    (apiClient.post as jest.Mock).mockResolvedValue(sent);

    await expect(options().mutationFn({ teamId: 2, edfiTenantId: 10, runId: 7 })).resolves.toBe(
      sent,
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      'teams/2/edfi-tenants/10/certification/runs/7/send-to-review',
      {},
    );
  });

  it("applies the sent run to the cached run and scenario statuses, so a failed refresh can't show it as editable", () => {
    const sent = { runId: 7, status: 'READY_FOR_REVIEW', canExecuteSteps: false };
    options().onSuccess(sent, { teamId: 2, edfiTenantId: 10, runId: 7 });

    const update = (key: readonly unknown[]) =>
      setQueryData.mock.calls.find(
        ([calledKey]) => JSON.stringify(calledKey) === JSON.stringify(key),
      )?.[1];

    expect(update(certificationQueryKeys.run(2, 7))).toBe(sent);
    const applyToStatuses = update(certificationQueryKeys.scenarioStatuses(2, 7));
    const scenarios = [{ scenarioId: 1, status: 'completed' }];
    expect(
      applyToStatuses({ run: { runId: 7, status: 'DRAFT', canExecuteSteps: true }, scenarios }),
    ).toEqual({
      run: { runId: 7, status: 'READY_FOR_REVIEW', canExecuteSteps: false },
      scenarios,
    });
    expect(applyToStatuses(undefined)).toBeUndefined();
  });

  it.each(['onSuccess', 'onError'] as const)(
    "refreshes the team's certification data %s, so the page shows the run's real status",
    (handler) => {
      options()[handler](undefined, { teamId: 2, edfiTenantId: 10, runId: 7 });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: certificationQueryKeys.all(2),
      });
    },
  );
});
