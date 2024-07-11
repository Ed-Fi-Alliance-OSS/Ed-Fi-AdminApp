import { EdfiTenant, Ods, SbEnvironment } from '@edanalytics/models-server';
import { BaseMgmtServiceV2 } from './base-mgmt-service';

type RowCountsProps = {
  sbEnvironment: SbEnvironment;
  edfiTenant: Pick<EdfiTenant, 'name'>;
  ods: Ods;
};

export class OdsRowCountService extends BaseMgmtServiceV2 {
  constructor() {
    super('dataFreshnessFunctionArn');
  }

  async rowCount({ sbEnvironment, edfiTenant, ods }: RowCountsProps) {
    const result = await this.executeMgmtFunction<string>(sbEnvironment, {
      Tenant: edfiTenant.name,
      ODS: ods.odsInstanceName,
    });
    return result;
  }
}
