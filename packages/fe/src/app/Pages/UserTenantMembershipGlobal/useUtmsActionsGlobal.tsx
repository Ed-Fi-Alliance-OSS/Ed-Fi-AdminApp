import { ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { AuthorizeComponent } from '../../helpers';

export const useUtmsActionsGlobal = (): ActionsType => {
  const navigate = useNavigate();
  return {
    Create: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
      const path = '/user-tenant-memberships/create';
      return (
        <AuthorizeComponent
          config={{
            privilege: 'user-tenant-membership:create',
            subject: {
              id: '__filtered__',
            },
          }}
        >
          <props.children
            icon={BiPlus}
            text="Create new"
            title={'Create new tenant membership'}
            to={path}
            onClick={() => navigate(path)}
          />
        </AuthorizeComponent>
      );
    },
  };
};
