import { ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { BiPlus } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { AuthorizeComponent } from '../../helpers';

export const useSbesGlobalActions = (): ActionsType => {
  const navigate = useNavigate();
  return {
    Create: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
      const to = `/sbes/create`;
      return (
        <AuthorizeComponent
          config={{
            privilege: 'sbe:create',
            subject: {
              id: '__filtered__',
            },
          }}
        >
          <props.children
            icon={BiPlus}
            text="Create"
            title={'Create Environment'}
            to={to}
            onClick={() => navigate(to)}
          />
        </AuthorizeComponent>
      );
    },
  };
};
