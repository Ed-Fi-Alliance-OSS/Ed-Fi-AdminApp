import { ActionsType } from '@edanalytics/common-ui';
import { GetOwnershipDto } from '@edanalytics/models';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { ownershipQueries } from '../../api';
import { useAuthorize } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useOwnershipGlobalActions = (ownership: GetOwnershipDto | undefined): ActionsType => {
  const params = useParams() as {
    ownershipId: string;
  };
  const popBanner = usePopBanner();
  const navigate = useNavigate();
  const to = (id: number | string) => `/ownerships/${id}`;
  const deleteOwnership = ownershipQueries.useDelete({});

  const canView = useAuthorize(
    ownership && {
      privilege: 'ownership:read',
      subject: {
        id: ownership.id,
      },
    }
  );

  const canEdit = useAuthorize(
    ownership && {
      privilege: 'ownership:update',
      subject: {
        id: ownership.id,
      },
    }
  );

  const canDelete = useAuthorize(
    ownership && {
      privilege: 'ownership:delete',
      subject: {
        id: ownership.id,
      },
    }
  );

  return ownership === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + ownership.displayName,
                to: to(ownership.id),
                onClick: () => navigate(to(ownership.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + ownership.displayName,
                to: to(ownership.id) + '?edit=true',
                onClick: () => navigate(to(ownership.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteOwnership.isLoading,
                text: 'Delete',
                title: 'Delete ownership',
                confirmBody: 'This will permanently delete the ownership.',
                onClick: () =>
                  deleteOwnership.mutateAsync(ownership.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/ownerships`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};
