import { ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { GetClaimsetDto } from '@edanalytics/models';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useNavContext, AuthorizeComponent } from '../../helpers';

export const useClaimsetActions = ({
  claimset,
}: {
  claimset: GetClaimsetDto | undefined;
}): ActionsType => {
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

  const navigate = useNavigate();
  const to = (id: number | string) => `/as/${asId}/sbes/${sbeId}/claimsets/${id}`;

  return claimset
    ? {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(claimset.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'tenant.sbe.claimset:read',
                subject: {
                  sbeId: Number(sbeId),
                  tenantId: Number(asId),
                  id: claimset.id,
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + claimset.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
      }
    : {};
};
