import { SbaaAdminApiVersion } from '@edanalytics/models';
import { useEdfiTenantNavContextLoaded } from './navContext';

export const VersioningHoc = (props: Partial<Record<SbaaAdminApiVersion, JSX.Element>>) => {
  const { sbEnvironment } = useEdfiTenantNavContextLoaded();
  const adminApiVersion = sbEnvironment.configPublic?.version;
  const rightChild = adminApiVersion ? props[adminApiVersion] : undefined;
  return rightChild ?? null;
};
