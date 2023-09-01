export type PgBossJobState =
  | 'created'
  | 'retry'
  | 'active'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'failed';
export interface ISbSyncQueue {
  id: string;
  name: string;
  priority: number;
  data: object;
  state: PgBossJobState;
  retrylimit: number;
  retrycount: number;
  retrydelay: number;
  retrybackoff: boolean;
  startafter: Date;
  startedon: Date;
  singletonkey: string;
  singletonon: Date | null;
  expirein: Date;
  createdon: Date;
  completedon: Date | null;
  keepuntil: Date;
  on_complete: boolean;
  output: object;
  archivedon: Date | null;
}
