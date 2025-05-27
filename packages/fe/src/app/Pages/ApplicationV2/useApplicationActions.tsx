import { ActionsType } from '@edanalytics/common-ui';

import { GetApplicationDtoV2, GetIntegrationAppDto, edorgKeyV2 } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { BiEdit, BiPlus, BiShieldX, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV2 } from '../../api';
import {
  useAuthorize,
  useNavToParent,
  useTeamEdfiTenantNavContext,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { QUERY_KEYS } from '../../api-v2';

export const useSingleApplicationActions = ({
  application,
}: {
  application: (GetApplicationDtoV2 & GetIntegrationAppDto) | undefined;
}): ActionsType => {
  const queryClient = useQueryClient();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const location = useLocation();
  const popBanner = usePopBanner();

  const deleteApplication = applicationQueriesV2.delete({
    edfiTenant,
    teamId: asId,
  });

  const search = useSearchParamsObject();
  const onApplicationPage =
    application && location.pathname.endsWith(`/applications/${application.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';

  const parentPath = useNavToParent();

  const canEdit = useAuthorize(
    application
      ? application.odsInstanceIds.flatMap((odsInstanceId) =>
          application.educationOrganizationIds.map((educationOrganizationIds) => ({
            privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:update',
            subject: {
              edfiTenantId: Number(edfiTenantId),
              teamId: Number(asId),
              id: edorgKeyV2({
                edorg: educationOrganizationIds,
                ods: odsInstanceId,
              }),
            },
          }))
        )
      : undefined
  );

  const resetCreds = applicationQueriesV2.resetCreds({
    edfiTenant: edfiTenant,
    teamId: asId,
  });

  const canReset = useAuthorize(
    application && !application.integrationProviderId
      ? application.odsInstanceIds.flatMap((odsInstanceId) =>
          application.educationOrganizationIds.map((educationOrganizationIds) => ({
            privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:reset-credentials',
            subject: {
              edfiTenantId: Number(edfiTenantId),
              teamId: Number(asId),
              id: edorgKeyV2({
                edorg: educationOrganizationIds,
                ods: odsInstanceId,
              }),
            },
          }))
        )
      : undefined
  );

  // TODO add "or" option to multi-configured useAuthorize
  const canView = true; /* useAuthorize(
    application && {
      privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:read',
      subject: {
        edfiTenantId: Number(edfiTenantId),
        teamId: Number(teamId),
        id: createEdorgCompositeNaturalKey({
          educationOrganizationId: application.educationOrganizationId,
          odsDbName: '',
        }),
      },
    }
  ); */

  const canDelete = useAuthorize(
    application
      ? application.odsInstanceIds.flatMap((odsInstanceId) =>
          application.educationOrganizationIds.map((educationOrganizationIds) => ({
            privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:delete',
            subject: {
              edfiTenantId: Number(edfiTenantId),
              teamId: Number(asId),
              id: edorgKeyV2({
                edorg: educationOrganizationIds,
                ods: odsInstanceId,
              }),
            },
          }))
        )
      : undefined
  );

  return application === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + application.applicationName,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`
                  ),
              },
            }
          : undefined),
        ...(canReset
          ? {
              Reset: {
                isPending: resetCreds.isPending,
                icon: BiShieldX,
                text: 'Reset creds',
                title: 'Reset application credentials.',
                onClick: () => {
                  resetCreds.mutateAsync(
                    { entity: { id: application.id }, pathParams: {} },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: (result) => {
                        navigate(
                          `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application?.id}`,
                          {
                            state: result.link,
                          }
                        );
                      },
                    }
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
                title: 'Edit ' + application.applicationName,
                to: `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}?edit=true`,
                onClick: () =>
                  navigate(
                    `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}?edit=true`
                  ),
              },
            }
          : undefined),
        ...(canDelete
          ? {
              Delete: {
                isPending: deleteApplication.isPending,
                icon: BiTrash,
                text: 'Delete',
                title: 'Delete application',
                confirmBody:
                  'All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want.',
                onClick: () =>
                  deleteApplication.mutate(
                    { id: application.id },
                    {
                      ...mutationErrCallback({ popGlobalBanner: popBanner }),
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: [QUERY_KEYS.edfiTenants, edfiTenantId, QUERY_KEYS.applications],
                        });
                        if (!!application.integrationProviderId) {
                          queryClient.invalidateQueries({
                            queryKey: [
                              QUERY_KEYS.integrationProviders,
                              application.integrationProviderId,
                              QUERY_KEYS.integrationApps,
                            ],
                          });
                        }
                        if (onApplicationPage) {
                          navigate(parentPath);
                        }
                      },
                    }
                  ),

                confirm: true,
              },
            }
          : undefined),
      };
};
export const useMultiApplicationActions = ({
  teamId,
}: {
  edfiTenantId: string | number;
  teamId: string | number;
}): ActionsType => {
  const navigate = useNavigate();
  const { sbEnvironmentId, edfiTenantId } = useTeamEdfiTenantNavContext();
  const to = `/as/${teamId}/sb-environments/${sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/create`;
  const canCreate = useAuthorize({
    privilege: 'team.sb-environment.edfi-tenant.ods.edorg.application:create',
    subject: {
      edfiTenantId: Number(edfiTenantId),
      teamId: Number(teamId),
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
