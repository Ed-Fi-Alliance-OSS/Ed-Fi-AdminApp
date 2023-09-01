import { ActionsType, LinkActionProps } from '@edanalytics/common-ui';
import { SbSyncQueueDto } from '@edanalytics/models';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { AuthorizeComponent } from '../../helpers';

export const useSbSyncQueueActions = (sbSyncQueue: SbSyncQueueDto | undefined): ActionsType => {
  const navigate = useNavigate();
  const to = (id: number | string) => `/sb-sync-queues/${id}`;
  return sbSyncQueue === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(sbSyncQueue.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'sb-sync-queue:read',
                subject: {
                  id: sbSyncQueue.id,
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + sbSyncQueue.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
      };
};
