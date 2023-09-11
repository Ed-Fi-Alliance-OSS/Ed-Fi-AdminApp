import { ActionsType } from '@edanalytics/common-ui';
import { GetClaimsetDto } from '@edanalytics/models';
import { HiOutlineEye } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useAuthorize, useNavContext } from '../../helpers';

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

  const canView = useAuthorize(
    claimset && {
      privilege: 'tenant.sbe.claimset:read',
      subject: {
        sbeId: Number(sbeId),
        tenantId: Number(asId),
        id: claimset.id,
      },
    }
  );

  return claimset && canView
    ? {
        View: {
          icon: HiOutlineEye,
          text: 'View',
          title: 'View ' + claimset.displayName,
          to: to(claimset.id),
          onClick: () => navigate(to(claimset.id)),
        },
      }
    : {};
};
