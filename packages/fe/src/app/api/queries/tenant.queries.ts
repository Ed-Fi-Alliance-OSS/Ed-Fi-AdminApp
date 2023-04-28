import { GetTenantDto, PostTenantDto, PutTenantDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useTenant = (id: number | string) =>
  useQuery({
    queryKey: [`tenant`, id],
    queryFn: () => methods.getOne(`${baseUrl}/tenants/${id}`, GetTenantDto),
  });

export const useTenants = () =>
  useQuery({
    queryKey: [`tenants`],
    queryFn: () =>
      methods.getManyMap<GetTenantDto>(`${baseUrl}/tenants`, GetTenantDto),
  });

export const usePostTenant = (tenant: PostTenantDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetTenantDto>, any>({
    mutationFn: () =>
      methods.post(`${baseUrl}/tenants`, PostTenantDto, GetTenantDto, tenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
};

export const usePutTenant = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenant: PutTenantDto) =>
      methods.put(
        `${baseUrl}/tenants/${tenant.id}`,
        PutTenantDto,
        GetTenantDto,
        tenant
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      callback && callback();
    },
  });
};

export const useDeleteTenant = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetTenantDto['id']) =>
      methods.delete(`${baseUrl}/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      callback && callback();
    },
  });
};
