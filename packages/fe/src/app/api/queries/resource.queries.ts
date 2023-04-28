import {
  GetResourceDto,
  PostResourceDto,
  PutResourceDto,
} from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useResource = (id: number | string) =>
  useQuery({
    queryKey: [`resource`, id],
    queryFn: () => methods.getOne(`${baseUrl}/resources/${id}`, GetResourceDto),
  });

export const useResources = () =>
  useQuery({
    queryKey: [`resources`],
    queryFn: () =>
      methods.getManyMap<GetResourceDto>(
        `${baseUrl}/resources`,
        GetResourceDto
      ),
  });

export const usePostResource = (resource: PostResourceDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetResourceDto>, any>({
    mutationFn: () =>
      methods.post(
        `${baseUrl}/resources`,
        PostResourceDto,
        GetResourceDto,
        resource
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
};

export const usePutResource = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resource: PutResourceDto) =>
      methods.put(
        `${baseUrl}/resources/${resource.id}`,
        PutResourceDto,
        GetResourceDto,
        resource
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      callback && callback();
    },
  });
};

export const useDeleteResource = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetResourceDto['id']) =>
      methods.delete(`${baseUrl}/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      callback && callback();
    },
  });
};
