import { ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { AuthorizeComponent, globalUserAuthConfig } from '../../helpers';

export const useMultipleUserGlobalActions = (): ActionsType => {
  const navigate = useNavigate();
  return {
    Create: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
      const path = `/users/create`;
      return (
        <AuthorizeComponent config={globalUserAuthConfig('user:create')}>
          <props.children
            icon={BiPlus}
            text="New"
            title={'Create new application user.'}
            to={path}
            onClick={() => navigate(path)}
          />
        </AuthorizeComponent>
      );
    },
  };
};
