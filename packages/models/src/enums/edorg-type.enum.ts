export enum EdorgType {
  'edfi.LocalEducationAgency' = 'edfi.LocalEducationAgency',
  'edfi.School' = 'edfi.School',
  'edfi.StateEducationAgency' = 'edfi.StateEducationAgency',
  'edfi.EducationOrganizationNetwork' = 'edfi.EducationOrganizationNetwork',
  'edfi.EducationServiceCenter' = 'edfi.EducationServiceCenter',
  'edfi.Other' = 'edfi.Other',
  'edfi.PostSecondaryInstitution' = 'edfi.PostSecondaryInstitution',
  'edfi.OrganizationDepartment' = 'edfi.OrganizationDepartment',
}

export const EdorgTypeShort: Record<EdorgType, string> = {
  'edfi.LocalEducationAgency': 'LEA',
  'edfi.School': 'School',
  'edfi.StateEducationAgency': 'SEA',
  'edfi.EducationOrganizationNetwork': 'Network',
  'edfi.EducationServiceCenter': 'ESC',
  'edfi.Other': 'Other',
  'edfi.PostSecondaryInstitution': 'Uni',
  'edfi.OrganizationDepartment': 'Org-Dept',
};
