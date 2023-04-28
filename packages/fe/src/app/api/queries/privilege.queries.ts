import {
  GetPrivilegeDto,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { methods } from '../methods';

const baseUrl = '';

export const usePrivilege = (id: number | string) =>
  useQuery({
    queryKey: [`privilege`, id],
    queryFn: () =>
      methods.getOne(`${baseUrl}/privileges/${id}`, GetPrivilegeDto),
  });

export const usePrivileges = () =>
  useQuery({
    queryKey: [`privileges`],
    queryFn: () =>
      methods.getMany<GetPrivilegeDto>(
        `${baseUrl}/privileges`,
        GetPrivilegeDto
      ).then(res => res.reduce((map, o) => {
        map[o.code] = o;
        return map;
      }, {} as Record<string, GetPrivilegeDto>)),
  });