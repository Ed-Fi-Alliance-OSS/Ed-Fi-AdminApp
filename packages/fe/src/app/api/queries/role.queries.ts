import { GetRoleDto, PostRoleDto, PutRoleDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useRole = (id: number | string) =>
  useQuery({
    queryKey: [`role`, id],
    queryFn: () => methods.getOne(`${baseUrl}/roles/${id}`, GetRoleDto),
  });

export const useRoles = () =>
  useQuery({
    queryKey: [`roles`],
    queryFn: () =>
      methods.getManyMap<GetRoleDto>(`${baseUrl}/roles`, GetRoleDto),
  });

export const usePostRole = (role: PostRoleDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetRoleDto>, any>({
    mutationFn: () =>
      methods.post(`${baseUrl}/roles`, PostRoleDto, GetRoleDto, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const usePutRole = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: PutRoleDto) =>
      methods.put(`${baseUrl}/roles/${role.id}`, PutRoleDto, GetRoleDto, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      callback && callback();
    },
  });
};

export const useDeleteRole = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetRoleDto['id']) =>
      methods.delete(`${baseUrl}/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      callback && callback();
    },
  });
};
