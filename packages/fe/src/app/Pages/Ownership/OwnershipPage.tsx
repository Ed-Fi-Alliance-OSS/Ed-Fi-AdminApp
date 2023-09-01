import { PageTemplate } from '@edanalytics/common-ui';
import { useNavigate, useParams } from 'react-router-dom';
import { ownershipQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { ViewOwnership } from './ViewOwnership';

export const OwnershipPage = () => {
  const params = useParams() as {
    asId: string;
    ownershipId: string;
  };
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const deleteOwnership = ownershipQueries.useDelete({
    callback: () => {
      navigate(navToParentOptions);
    },
    tenantId: params.asId,
  });
  const ownership = ownershipQueries.useOne({
    id: params.ownershipId,
    tenantId: params.asId,
  }).data;

  return (
    <PageTemplate title={ownership?.displayName || 'Ownership'}>
      {ownership ? <ViewOwnership /> : null}
    </PageTemplate>
  );
};
