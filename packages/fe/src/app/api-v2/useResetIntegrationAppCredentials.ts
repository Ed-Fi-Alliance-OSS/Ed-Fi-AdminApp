import { useMutation } from '@tanstack/react-query';
import { ApplicationYopassResponseDto } from '@edanalytics/models';
import { apiClient } from './apiClient';
import { useNavContext } from '../helpers';

export const useResetIntegrationAppCredentials = () => {
  const { asId: teamId } = useNavContext();
  return useMutation({
    mutationFn: async ({
      integrationAppId,
      integrationProviderId,
    }: {
      integrationAppId: number;
      integrationProviderId: number;
    }) => {
      const response = await apiClient.put(
        `teams/${teamId}/integration-providers/${integrationProviderId}/integration-apps/${integrationAppId}/reset-credentials?shouldGetOneTimeShareLink=true`
      );
      return response as ApplicationYopassResponseDto;
    },
  });
};
