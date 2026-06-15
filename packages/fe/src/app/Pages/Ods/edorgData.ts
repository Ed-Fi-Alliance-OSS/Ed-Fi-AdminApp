export interface EdorgSampleRow {
  id: number;
  educationOrganizationId: number;
  nameOfInstitution: string;
  shortNameOfInstitution: string | null;
  discriminator: string;
  parentId: number | null;
}

export const sampleEdorgData: EdorgSampleRow[] = [
  {
    id: 1,
    educationOrganizationId: 31,
    nameOfInstitution: 'Grand Bend State',
    shortNameOfInstitution: null,
    discriminator: 'edfi.StateEducationAgency',
    parentId: null,
  },
  {
    id: 2,
    educationOrganizationId: 255901,
    nameOfInstitution: 'Grand Bend ISD',
    shortNameOfInstitution: null,
    discriminator: 'edfi.LocalEducationAgency',
    parentId: 1,
  },
  {
    id: 3,
    educationOrganizationId: 255901107,
    nameOfInstitution: 'Grand Bend High School',
    shortNameOfInstitution: null,
    discriminator: 'edfi.School',
    parentId: 2,
  },
];
