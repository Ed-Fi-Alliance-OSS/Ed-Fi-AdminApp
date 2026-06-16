export type OdsStatus =
  | 'PendingCreate'
  | 'Created'
  | 'CreateInProgress'
  | 'CreateFailed'
  | 'CreateError'
  | 'PendingDelete'
  | 'DeleteInProgress'
  | 'Deleted'
  | 'DeleteFailed'
  | 'DeleteError';

export interface OdsStatusDisplay {
  label: string;
  colorScheme: string;
}

export const odsStatusDisplayMap: Record<OdsStatus, OdsStatusDisplay> = {
  PendingCreate:    { label: 'Pending to create',    colorScheme: 'yellow' },
  Created:          { label: 'Ready',                 colorScheme: 'green'  },
  CreateInProgress: { label: 'Creation in progress',           colorScheme: 'yellow' },
  CreateFailed:     { label: 'Creation failed',       colorScheme: 'red'    },
  CreateError:      { label: 'Creation failed',       colorScheme: 'red'    },
  PendingDelete:    { label: 'Deletion pending',      colorScheme: 'yellow' },
  DeleteInProgress: { label: 'Deletion in progress',  colorScheme: 'yellow' },
  Deleted:          { label: 'Deleted',               colorScheme: 'green'  },
  DeleteFailed:     { label: 'Deletion failed',       colorScheme: 'red'    },
  DeleteError:      { label: 'Deletion failed',       colorScheme: 'red'    },
};

export interface OdsSampleRow {
  id: number;
  name: string;
  type: 'Minimal' | 'Sample';
  status: OdsStatus;
  databaseName: string | null;
}

export const sampleOdsData: OdsSampleRow[] = [
  { id: 1, name: 'Grand Bend ISD',          type: 'Minimal', status: 'Created',          databaseName: 'EdFi_Ods_GrandBend_Minimal'  },
  { id: 2, name: 'Northridge USD',           type: 'Sample',  status: 'Created',          databaseName: 'EdFi_Ods_Northridge_Sample'  },
  { id: 3, name: 'Lakewood City Schools',    type: 'Minimal', status: 'PendingCreate',    databaseName: null                          },
  { id: 4, name: 'Sunridge Academy',         type: 'Sample',  status: 'CreateInProgress', databaseName: null                          },
  { id: 5, name: 'Maplewood District',       type: 'Minimal', status: 'PendingDelete',    databaseName: null                          },
  { id: 6, name: 'Riverside Unified',        type: 'Sample',  status: 'DeleteInProgress', databaseName: null                          },
  { id: 7, name: 'Cedar Valley ISD',         type: 'Minimal', status: 'CreateFailed',     databaseName: null                          },
  { id: 8, name: 'Pinecrest Public Schools', type: 'Sample',  status: 'DeleteFailed',     databaseName: null                          },
];
