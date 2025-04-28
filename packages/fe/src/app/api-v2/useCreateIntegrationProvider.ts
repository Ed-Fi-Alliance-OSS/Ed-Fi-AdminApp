import { useMutation } from '@tanstack/react-query';
import { GetIntegrationProviderDto, PostIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';

export const useCreateIntegrationProvider = () => {
  return useMutation({
    mutationFn: async (body: PostIntegrationProviderDto) => {
      const response = await apiClient.post('integration-providers', body);
      return response as GetIntegrationProviderDto;
    },
  });
};
