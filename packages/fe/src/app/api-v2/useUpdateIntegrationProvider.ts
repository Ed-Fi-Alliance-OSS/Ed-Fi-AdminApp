import { useMutation } from '@tanstack/react-query';
import { GetIntegrationProviderDto, PutIntegrationProviderDto } from '@edanalytics/models';
import { apiClient } from './apiClient';

export const useUpdateIntegrationProvider = () => {
  return useMutation({
    mutationFn: async (body: PutIntegrationProviderDto) => {
      const response = await apiClient.put(`integration-providers/${body.id}`, body);
      return response as GetIntegrationProviderDto;
    },
  });
};
