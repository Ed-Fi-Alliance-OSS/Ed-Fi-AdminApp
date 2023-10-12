import { ActionsType } from '@edanalytics/common-ui';

import { GetApplicationDto, createEdorgCompositeNaturalKey } from '@edanalytics/models';
import { BiEdit, BiPlus, BiShieldX, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueries, useApplicationResetCredential } from '../../api';
import { useAuthorize, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

export const useSingleApplicationActions = ({
  application,
  sbeId,
  tenantId,
}: {
  application: GetApplicationDto | undefined;
  sbeId: string | number;
  tenantId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const location = useLocation();
  const popBanner = usePopBanner();

  const deleteApplication = applicationQueries.useDelete({
    sbeId: sbeId,
    tenantId: tenantId,
  });

  const search = useSearchParamsObject();
  const onApplicationPage =
    application && location.pathname.endsWith(`/applications/${application.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';

  const parentPath = useNavToParent();

  const canEdit = useAuthorize(
    application && {
      privilege: 'tenant.sbe.edorg.application:update',
      subject: {
        sbeId: Number(sbeId),
        tenantId: Number(tenantId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  );

  const resetCreds = useApplicationResetCredential({
    sbeId: sbeId,
    tenantId: tenantId,
    callback: (result) => {
      navigate(`/as/${tenantId}/sbes/${sbeId}/applications/${application?.id}`, {
        state: result.link,
      });
    },
  });

  const canReset = useAuthorize(
    application && {
      privilege: 'tenant.sbe.edorg.application:reset-credentials',
      subject: {
        sbeId: Number(sbeId),
        tenantId: Number(tenantId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  );

  const canView = useAuthorize(
    application && {
      privilege: 'tenant.sbe.edorg.application:read',
      subject: {
        sbeId: Number(sbeId),
        tenantId: Number(tenantId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  );

  const canDelete = useAuthorize(
    application && {
      privilege: 'tenant.sbe.edorg.application:delete',
      subject: {
        sbeId: Number(sbeId),
        tenantId: Number(tenantId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  );

  return application === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + application.displayName,
                to: `/as/${tenantId}/sbes/${sbeId}/applications/${application.id}`,
                onClick: () =>
                  navigate(`/as/${tenantId}/sbes/${sbeId}/applications/${application.id}`),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isLoading: resetCreds.isLoading,
                icon: BiShieldX,
                text: 'Reset creds',
                title: 'Reset application credentials.',
                onClick: () => {
                  resetCreds.mutateAsync(
                    application,
                    mutationErrCallback({ popGlobalBanner: popBanner })
                  );
                },
                confirm: true,
                confirmBody:
                  'Are you sure you want to reset the credentials? Anything using the current ones will stop working.',
              },
            }
          : undefined),
        ...(canEdit
          ? {
              Edit: {
                isDisabled: inEdit,
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + application.displayName,
                to: `/as/${tenantId}/sbes/${sbeId}/applications/${application.id}?edit=true`,
                onClick: () =>
                  navigate(
                    `/as/${tenantId}/sbes/${sbeId}/applications/${application.id}?edit=true`
                  ),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isLoading: deleteApplication.isLoading,
                icon: BiTrash,
                text: 'Delete',
                title: 'Delete application',
                confirmBody:
                  'All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want.',
                onClick: () =>
                  deleteApplication.mutate(application.id, {
                    ...mutationErrCallback({ popGlobalBanner: popBanner }),
                    onSuccess: () => {
                      if (onApplicationPage) {
                        navigate(parentPath);
                      }
                    },
                  }),

                confirm: true,
              },
            }
          : undefined),
      };
};
export const useMultiApplicationActions = ({
  sbeId,
  tenantId,
}: {
  sbeId: string | number;
  tenantId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const to = `/as/${tenantId}/sbes/${sbeId}/applications/create`;
  const canCreate = useAuthorize({
    privilege: 'tenant.sbe.edorg.application:create',
    subject: {
      sbeId: Number(sbeId),
      tenantId: Number(tenantId),
      id: '__filtered__',
    },
  });
  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'New',
          title: 'New application',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};
