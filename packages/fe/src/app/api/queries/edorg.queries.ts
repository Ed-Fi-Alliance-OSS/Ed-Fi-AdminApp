import { GetEdorgDto, PostEdorgDto, PutEdorgDto } from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useEdorg = (id: number | string, sbeId: number | string) =>
  useQuery({
    queryKey: [`edorg`, id],
    queryFn: () => methods.getOne(`${baseUrl}sbes/${sbeId}/edorgs/${id}`, GetEdorgDto),
  });

export const useEdorgs = (sbeId: number | string) =>
  useQuery({
    queryKey: [`edorgs`, 'sbe', sbeId],
    queryFn: () =>
      methods.getManyMap<GetEdorgDto>(`${baseUrl}sbes/${sbeId}/edorgs`, GetEdorgDto),
  });

export const usePostEdorg = (edorg: PostEdorgDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetEdorgDto>, any>({
    mutationFn: () =>
      methods.post(`${baseUrl}/edorgs`, PostEdorgDto, GetEdorgDto, edorg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edorgs'] });
    },
  });
};

export const usePutEdorg = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (edorg: PutEdorgDto) =>
      methods.put(
        `${baseUrl}/edorgs/${edorg.id}`,
        PutEdorgDto,
        GetEdorgDto,
        edorg
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edorgs'] });
      callback && callback();
    },
  });
};

export const useDeleteEdorg = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetEdorgDto['id']) =>
      methods.delete(`${baseUrl}/edorgs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edorgs'] });
      callback && callback();
    },
  });
};
