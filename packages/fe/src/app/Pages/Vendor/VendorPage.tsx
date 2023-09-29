import { PageActions, PageTemplate } from '@edanalytics/common-ui';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router-dom';
import { vendorQueries } from '../../api';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { EditVendor } from './EditVendor';
import { ViewVendor } from './ViewVendor';
import { useVendorActions } from './useVendorActions';
import omit from 'lodash/omit';

export const VendorPageContent = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    vendorId: string;
  };
  const vendor = vendorQueries.useOne({
    tenantId: params.asId,
    id: params.vendorId,
    sbeId: params.sbeId,
  }).data;
  const { edit } = useSearchParamsObject() as { edit?: boolean };

  return vendor ? edit ? <EditVendor vendor={vendor} /> : <ViewVendor /> : null;
};

const VendorPageTitle = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    vendorId: string;
  };
  const vendor = vendorQueries.useOne({
    tenantId: params.asId,
    id: params.vendorId,
    sbeId: params.sbeId,
  }).data;
  return <>{vendor?.company || 'Vendor'}</>;
};

export const VendorPage = () => {
  return (
    <PageTemplate
      title={
        <ErrorBoundary fallbackRender={() => 'Vendor'}>
          <VendorPageTitle />
        </ErrorBoundary>
      }
      actions={<VendorPageActions />}
    >
      <VendorPageContent />
    </PageTemplate>
  );
};

export const VendorPageActions = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    vendorId: string;
  };
  const vendor = vendorQueries.useOne({
    tenantId: params.asId,
    id: params.vendorId,
    sbeId: params.sbeId,
  }).data;

  const actions = useVendorActions(vendor);
  return <PageActions actions={omit(actions, 'View')} />;
};
