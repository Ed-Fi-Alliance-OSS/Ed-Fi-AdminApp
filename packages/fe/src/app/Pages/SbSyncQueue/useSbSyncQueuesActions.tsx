import { ActionsType } from '@edanalytics/common-ui';
import { HiInboxIn } from 'react-icons/hi';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { usePostSbSyncQueue } from '../../api';
import { useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useSbSyncQueuesActions = (): ActionsType => {
  const postSyncQueue = usePostSbSyncQueue();
  const popBanner = usePopBanner();

  const canQueue = useAuthorize({
    privilege: 'sbe:refresh-resources',
    subject: {
      id: '__filtered__',
    },
  });

  return canQueue
    ? {
        Queue: {
          icon: HiInboxIn,
          isLoading: postSyncQueue.isLoading,
          text: 'Sync all environments',
          title: 'Trigger sync of all environments',
          onClick: () =>
            postSyncQueue.mutateAsync(undefined, {
              ...mutationErrCallback({ popGlobalBanner: popBanner }),
              onSuccess: (res) => popBanner(res),
            }),
        },
      }
    : {};
};
