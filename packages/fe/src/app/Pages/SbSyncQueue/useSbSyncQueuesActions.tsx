import { ActionProps, ActionsType } from '@edanalytics/common-ui';
import { HiInboxIn } from 'react-icons/hi';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { usePostSbSyncQueue } from '../../api';
import { AuthorizeComponent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSbSyncQueuesActions = (): ActionsType => {
  const postSyncQueue = usePostSbSyncQueue();
  const popBanner = usePopBanner();

  return {
    Queue: (props: { children: (props: ActionProps) => JSX.Element }) => {
      return (
        <AuthorizeComponent
          config={{
            privilege: 'sbe:refresh-resources',
            subject: {
              id: '__filtered__',
            },
          }}
        >
          <props.children
            icon={HiInboxIn}
            isLoading={postSyncQueue.isLoading}
            text="Sync all environments"
            title={'Trigger sync of all environments'}
            onClick={() =>
              postSyncQueue.mutateAsync(undefined, {
                ...mutationErrCallback({ popBanner }),
                onSuccess: (res) => popBanner(res),
              })
            }
          />
        </AuthorizeComponent>
      );
    },
  };
};
