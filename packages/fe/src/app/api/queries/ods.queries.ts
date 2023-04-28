import { GetOdsDto, PostOdsDto, PutOdsDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useOds = (id: number | string, sbeId: number | string) =>
  useQuery({
    queryKey: [`ods`, id],
    queryFn: () => methods.getOne(`${baseUrl}sbes/${sbeId}/odss/${id}`, GetOdsDto),
  });

export const useOdss = (sbeId: number | string) =>
  useQuery({
    queryKey: [`odss`, 'sbe', sbeId],
    queryFn: () => methods.getManyMap<GetOdsDto>(`${baseUrl}sbes/${sbeId}/odss`, GetOdsDto),
  });

export const usePostOds = (ods: PostOdsDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetOdsDto>, any>({
    mutationFn: () =>
      methods.post(`${baseUrl}/odss`, PostOdsDto, GetOdsDto, ods),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odss'] });
    },
  });
};

export const usePutOds = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ods: PutOdsDto) =>
      methods.put(`${baseUrl}/odss/${ods.id}`, PutOdsDto, GetOdsDto, ods),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odss'] });
      callback && callback();
    },
  });
};

export const useDeleteOds = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetOdsDto['id']) =>
      methods.delete(`${baseUrl}/odss/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odss'] });
      callback && callback();
    },
  });
};
