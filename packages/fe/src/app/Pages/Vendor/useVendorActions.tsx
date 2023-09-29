import { ActionsType } from '@edanalytics/common-ui';
import { GetVendorDto } from '@edanalytics/models';
import { BiEdit, BiPlus, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueries } from '../../api';
import { useAuthorize, useNavContext, vendorAuthConfig } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

export const useVendorActions = (vendor: GetVendorDto | undefined): ActionsType => {
  const { asId, sbeId } = useNavContext() as {
    asId: number;
    sbeId: number;
  };

  const navigate = useNavigate();
  const to = (id: number | string) => `/as/${asId}/sbes/${sbeId}/vendors/${id}`;
  const deleteVendor = vendorQueries.useDelete({ sbeId, tenantId: asId });
  const popBanner = usePopBanner();
  const canView = useAuthorize(vendorAuthConfig(sbeId, asId, 'tenant.sbe.vendor:read'));

  const canEdit = useAuthorize(vendorAuthConfig(sbeId, asId, 'tenant.sbe.vendor:update'));

  const canDelete = useAuthorize(vendorAuthConfig(sbeId, asId, 'tenant.sbe.vendor:delete'));

  return vendor === undefined
    ? {}
    : {
        ...(canView
          ? {
              View: {
                icon: HiOutlineEye,
                text: 'View',
                title: 'View ' + vendor.displayName,
                to: to(vendor.id),
                onClick: () => navigate(to(vendor.id)),
              },
            }
          : {}),
        ...(canEdit
          ? {
              Edit: {
                icon: BiEdit,
                text: 'Edit',
                title: 'Edit ' + vendor.displayName,
                to: to(vendor.id) + '?edit=true',
                onClick: () => navigate(to(vendor.id) + '?edit=true'),
              },
            }
          : {}),
        ...(canDelete
          ? {
              Delete: {
                icon: BiTrash,
                isLoading: deleteVendor.isLoading,
                text: 'Delete',
                title: 'Delete vendor',
                confirmBody: 'This will permanently delete the vendor.',
                onClick: () =>
                  deleteVendor.mutateAsync(vendor.id, {
                    ...mutationErrCallback({ popBanner }),
                    onSuccess: () => navigate(`/as/${asId}/sbes/${sbeId}/vendors`),
                  }),
                confirm: true,
              },
            }
          : {}),
      };
};

export const useManyVendorActions = (): ActionsType => {
  const { asId, sbeId } = useNavContext() as {
    asId: number;
    sbeId: number;
  };

  const navigate = useNavigate();
  const to = `/as/${asId}/sbes/${sbeId}/vendors/create`;
  const canCreate = useAuthorize(vendorAuthConfig(sbeId, asId, 'tenant.sbe.vendor:create'));

  return canCreate
    ? {
        Create: {
          icon: BiPlus,
          text: 'New',
          title: 'New vendor',
          to,
          onClick: () => navigate(to),
        },
      }
    : {};
};
