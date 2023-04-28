import {
  GetOwnershipDto,
  PostOwnershipDto,
  PutOwnershipDto,
} from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useOwnership = (id: number | string) =>
  useQuery({
    queryKey: [`ownership`, id],
    queryFn: () =>
      methods.getOne(`${baseUrl}/ownerships/${id}`, GetOwnershipDto),
  });

export const useOwnerships = () =>
  useQuery({
    queryKey: [`ownerships`],
    queryFn: () =>
      methods.getManyMap<GetOwnershipDto>(
        `${baseUrl}/ownerships`,
        GetOwnershipDto
      ),
  });

export const usePostOwnership = (ownership: PostOwnershipDto) => {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, AxiosResponse<GetOwnershipDto>, any>({
    mutationFn: () =>
      methods.post(
        `${baseUrl}/ownerships`,
        PostOwnershipDto,
        GetOwnershipDto,
        ownership
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerships'] });
    },
  });
};

export const usePutOwnership = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ownership: PutOwnershipDto) =>
      methods.put(
        `${baseUrl}/ownerships/${ownership.id}`,
        PutOwnershipDto,
        GetOwnershipDto,
        ownership
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerships'] });
      callback && callback();
    },
  });
};

export const useDeleteOwnership = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetOwnershipDto['id']) =>
      methods.delete(`${baseUrl}/ownerships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerships'] });
      callback && callback();
    },
  });
};
