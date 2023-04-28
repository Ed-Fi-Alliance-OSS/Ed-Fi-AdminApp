import {
  GetUserTenantMembershipDto,
  PostUserTenantMembershipDto,
  PutUserTenantMembershipDto,
} from '@edanalytics/models';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';
import { methods } from '../methods';

const baseUrl = '';

export const useUserTenantMembership = (id: number | string) =>
  useQuery({
    queryKey: [`user-tenant-membership`, id],
    queryFn: () =>
      methods.getOne(
        `${baseUrl}/user-tenant-memberships/${id}`,
        GetUserTenantMembershipDto
      ),
  });

export const useUserTenantMemberships = () =>
  useQuery({
    queryKey: [`user-tenant-memberships`],
    queryFn: () =>
      methods.getManyMap<GetUserTenantMembershipDto>(
        `${baseUrl}/user-tenant-memberships`,
        GetUserTenantMembershipDto
      ),
  });

export const usePostUserTenantMembership = (
  userTenantMembership: PostUserTenantMembershipDto
) => {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    unknown,
    AxiosResponse<GetUserTenantMembershipDto>,
    any
  >({
    mutationFn: () =>
      methods.post(
        `${baseUrl}/user-tenant-memberships`,
        PostUserTenantMembershipDto,
        GetUserTenantMembershipDto,
        userTenantMembership
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tenant-memberships'] });
    },
  });
};

export const usePutUserTenantMembership = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userTenantMembership: PutUserTenantMembershipDto) =>
      methods.put(
        `${baseUrl}/user-tenant-memberships/${userTenantMembership.id}`,
        PutUserTenantMembershipDto,
        GetUserTenantMembershipDto,
        userTenantMembership
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tenant-memberships'] });
      callback && callback();
    },
  });
};

export const useDeleteUserTenantMembership = (callback?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: GetUserTenantMembershipDto['id']) =>
      methods.delete(`${baseUrl}/user-tenant-memberships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tenant-memberships'] });
      callback && callback();
    },
  });
};
