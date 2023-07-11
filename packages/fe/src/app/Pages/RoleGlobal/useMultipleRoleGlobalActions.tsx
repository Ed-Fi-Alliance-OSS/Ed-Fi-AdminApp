import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { AuthorizeComponent, globalRoleAuthConfig } from '../../helpers';
import { ActionsType, LinkActionProps } from '../../helpers/ActionsType';

export const useMultipleRoleGlobalActions = (): ActionsType => {
  const navigate = useNavigate();
  return {
    Create: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
      const path = '/roles/create';
      return (
        <AuthorizeComponent config={globalRoleAuthConfig('__filtered__', 'role:create')}>
          <props.children
            icon={BiPlus}
            text="Create new"
            title={'Create new user or ownership role'}
            to={path}
            onClick={() => navigate(path)}
          />
        </AuthorizeComponent>
      );
    },
  };
};
