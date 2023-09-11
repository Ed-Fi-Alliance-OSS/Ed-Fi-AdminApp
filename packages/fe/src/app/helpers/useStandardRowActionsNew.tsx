import { TenantBasePrivilege, TenantSbePrivilege } from '@edanalytics/models';
import { HiOutlineEye } from 'react-icons/hi';
import { RouteObject, generatePath, useNavigate } from 'react-router-dom';

export type BaseRow = { id: number; displayName: string };

export const useReadTenantEntity = (props: {
  route: RouteObject;
  entity: BaseRow | undefined;
  params: { asId: string | number; sbeId?: string | number | undefined } & Record<
    any,
    string | number
  >;
  privilege: TenantBasePrivilege | TenantSbePrivilege;
}) => {
  const path = props.route.path!;
  const navigate = useNavigate();
  const { params, entity, privilege } = props;
  const toOptions = generatePath(path, params);
  return entity === undefined
    ? undefined
    : {
        icon: HiOutlineEye,
        text: 'View',
        title: 'View ' + entity.displayName,
        to: toOptions,
        onClick: () => navigate(toOptions),
      };
};
