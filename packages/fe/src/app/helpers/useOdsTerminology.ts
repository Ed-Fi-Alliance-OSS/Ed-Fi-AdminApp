import { useTeamEdfiTenantNavContextLoaded } from './navContext';

export interface OdsTerminology {
  singular: string;
  plural: string;
  listTitle: string;
  createTitle: string;
}

export const getOdsTerminology = (version: string | undefined): OdsTerminology =>
  version === 'v3'
    ? {
        singular: 'Data Store',
        plural: 'Data Stores',
        listTitle: 'Data Stores',
        createTitle: 'Create new Data Store',
      }
    : {
        singular: 'ODS',
        plural: "ODS's",
        listTitle: 'Operational Data Stores',
        createTitle: 'Create new ODS',
      };

export const useOdsTerminology = (): OdsTerminology => {
  const { sbEnvironment } = useTeamEdfiTenantNavContextLoaded();
  return getOdsTerminology(sbEnvironment.version);
};
