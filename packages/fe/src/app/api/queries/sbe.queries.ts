import { GetSbeDto, PostSbeDto, PutSbeDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useSbe = (id: number | string) =>
  useQuery({
    queryKey: [`sbe`, id],
    queryFn: () => methods.getOne(`${baseUrl}/sbes/${id}`, GetSbeDto),
  });

export const useSbes = () =>
  useQuery({
    queryKey: [`sbes`],
    queryFn: () => methods.getManyMap<GetSbeDto>(`${baseUrl}/sbes`, GetSbeDto),
  });

export const usePostSbe = (sbe: PostSbeDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetSbeDto>, any>({
    mutationFn: () =>
      methods.post(`${baseUrl}/sbes`, PostSbeDto, GetSbeDto, sbe),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sbes'] });
    },
  });
};

export const usePutSbe = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sbe: PutSbeDto) =>
      methods.put(`${baseUrl}/sbes/${sbe.id}`, PutSbeDto, GetSbeDto, sbe),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sbes'] });
      callback && callback();
    },
  });
};

export const useDeleteSbe = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetSbeDto['id']) =>
      methods.delete(`${baseUrl}/sbes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sbes'] });
      callback && callback();
    },
  });
};
