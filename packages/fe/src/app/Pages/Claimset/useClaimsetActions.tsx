import { ActionsType } from '@edanalytics/common-ui';
import { GetClaimsetDto } from '@edanalytics/models';
import { BiEdit, BiExport, BiImport, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueries } from '../../api';
import { claimsetAuthConfig, useAuthorize, useNavContext } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { RowSelectionState } from '@tanstack/react-table';

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
  const deleteClaimset = claimsetQueries.useDelete({ sbeId, tenantId: asId });
  const popBanner = usePopBanner();

  const canView = useAuthorize(claimsetAuthConfig(sbeId, asId, 'tenant.sbe.claimset:read'));
  const canEdit =
    useAuthorize(claimsetAuthConfig(sbeId, asId, 'tenant.sbe.claimset:update')) &&
    claimset &&
    !claimset.isSystemReserved;
  const canDelete =
    useAuthorize(claimsetAuthConfig(sbeId, asId, 'tenant.sbe.claimset:delete')) &&
    claimset &&
    !claimset.isSystemReserved;

  return claimset
    ? {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + claimset.displayName,
                to: to(claimset.id),
                onClick: () => navigate(to(claimset.id)),
              },
              Export: {
                icon: BiExport,
                text: 'Export',
                title: 'Export ' + claimset.displayName,
                onClick: () => {
                  window.open(
                    `${
                      import.meta.env.VITE_API_URL
                    }/api/tenants/${asId}/sbes/${sbeId}/claimsets/export?id=${claimset.id}`,
                    '_blank'
                  );
                },
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + claimset.displayName,
                to: to(claimset.id) + '?edit=true',
                onClick: () => navigate(to(claimset.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteClaimset.isLoading,
                text: 'Delete',
                title: 'Delete claimset',
                confirmBody: 'This will permanently delete the claimset.',
                onClick: () =>
                  deleteClaimset.mutateAsync(claimset.id, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess: () => navigate(`/as/${asId}/sbes/${sbeId}/claimsets`),
                  }),
                confirm: true,
              },
            }
          : {}),
      }
    : {};
};

export const useManyClaimsetActions = ({
  selectionState,
}: {
  selectionState: RowSelectionState;
}): ActionsType => {
  const { asId, sbeId } = useNavContext() as {
    asId: number;
    sbeId: number;
  };

  const navigate = useNavigate();
  const toCreate = `/as/${asId}/sbes/${sbeId}/claimsets/create`;
  const toImport = `/as/${asId}/sbes/${sbeId}/claimsets/import`;
  const canCreate = useAuthorize(claimsetAuthConfig(sbeId, asId, 'tenant.sbe.claimset:create'));
  const canRead = useAuthorize(claimsetAuthConfig(sbeId, asId, 'tenant.sbe.claimset:read'));

  return {
    ...(canCreate
      ? {
          // Create: {
          //   icon: BiPlus,
          //   text: 'New',
          //   title: 'New claimset',
          //   to: toCreate,
          //   onClick: () => navigate(toCreate),
          // },
          Import: {
            icon: BiImport,
            text: 'Import',
            title: 'Import claimsets from Ed-Fi Admin App',
            to: toImport,
            onClick: () => navigate(toImport),
          },
        }
      : {}),
    ...(canRead && Object.keys(selectionState).length > 0
      ? {
          Export: {
            icon: BiExport,
            text: 'Export',
            title: 'Export selected claimsets',
            onClick: () => {
              window.open(
                `${
                  import.meta.env.VITE_API_URL
                }/api/tenants/${asId}/sbes/${sbeId}/claimsets/export?id=${Object.keys(
                  selectionState
                ).join('&id=')}`,
                '_blank'
              );
            },
          },
        }
      : {}),
  };
};
