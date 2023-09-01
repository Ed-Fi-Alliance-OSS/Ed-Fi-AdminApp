import { TenantBasePrivilege, TenantSbePrivilege, isSbePrivilege } from '@edanalytics/models';
import { HiOutlineEye } from 'react-icons/hi';
import { RouteObject, generatePath, useNavigate } from 'react-router-dom';
import { AuthorizeComponent } from './Authorize';
import { LinkActionProps } from '@edanalytics/common-ui';

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

  return entity === undefined
    ? undefined
    : (renderProps: { children: (props: LinkActionProps) => JSX.Element }) => {
        const toOptions = generatePath(path, params);
        return (
          <AuthorizeComponent
            config={{
              privilege: privilege,
              subject: {
                tenantId: Number(params.asId),
                sbeId: isSbePrivilege(privilege) ? Number(params.sbeId) : undefined,
                id: entity.id,
              },
            }}
          >
            <renderProps.children
              icon={HiOutlineEye}
              text="View"
              title={'View ' + entity.displayName}
              to={toOptions}
              onClick={() => navigate(toOptions)}
            />
          </AuthorizeComponent>
        );
      };
};
