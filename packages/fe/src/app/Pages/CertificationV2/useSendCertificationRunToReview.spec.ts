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
  const options = () => (useMutation as jest.Mock).mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
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
