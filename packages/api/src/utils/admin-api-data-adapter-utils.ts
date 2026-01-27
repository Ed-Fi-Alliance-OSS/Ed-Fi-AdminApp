import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
    EducationOrganizationDto,
    EdorgType,
    OdsInstanceDto,
  TenantDto,
  IOds,
  IEdorg,
} from '@edanalytics/models';

export const transformTenantData = (apiTenants: TenantDto, sbEnvironment: SbEnvironment): Partial<EdfiTenant> => {
  return {
    name: apiTenants.name,
    sbEnvironmentId: sbEnvironment.id,
    created: new Date(),
    odss: apiTenants.odsInstances?.map((instance: OdsInstanceDto, index: number) => {
      const odsData: Partial<IOds> = {
        id: 0,
        odsInstanceId: instance.id,
        odsInstanceName: instance.name,
        ownerships: [],
        edfiTenantId: 0,
        sbEnvironmentId: sbEnvironment.id,
        edorgs: instance.edOrgs?.map((edorg: EducationOrganizationDto) => {
          const edorgData: Partial<IEdorg> = {
            odsInstanceId: edorg.instanceId,
            educationOrganizationId: edorg.educationOrganizationId,
            nameOfInstitution: edorg.nameOfInstitution,
            shortNameOfInstitution: edorg.shortNameOfInstitution || null,
            discriminator: edorg.discriminator as EdorgType,
            parentId: edorg.parentId,
          };
          return edorgData as IEdorg;
        }) || []
      };
      return odsData as IOds;
    }) || [],
  };
};
