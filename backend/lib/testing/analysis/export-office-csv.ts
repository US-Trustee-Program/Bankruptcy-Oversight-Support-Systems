import { InvocationContext } from '@azure/functions';
import applicationContextCreator from '../../../function-apps/azure/application-context-creator';
import { LoggerImpl } from '../../adapters/services/logger.service';
import OfficesDxtrGateway from '../../adapters/gateways/dxtr/offices.dxtr.gateway';
import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import * as fs from 'fs/promises';

const MODULE_NAME = 'ITEST';

function toCommaDelimitedString(record: string[]) {
  record.forEach((item, idx) => {
    if (item.includes(',')) {
      record[idx] = '"' + item + '"';
    }
  });
  return record.join(',');
}

function officesToCsv(offices: UstpOfficeDetails[]) {
  const records: string[] = offices
    .map((office) => [
      office.officeCode,
      office.idpGroupName,
      office.officeName,
      office.regionId,
      office.regionName,
    ])
    .map(toCommaDelimitedString);
  records.unshift('OFFICE_ID,OKTA_GROUP_NAME,OFFICE_NAME,REGION_ID,REGION_NAME');
  return records;
}

async function exportCsv() {
  const context = await applicationContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
    logger: new LoggerImpl('analysis'),
  });
  try {
    context.logger.info(MODULE_NAME, 'Getting offices from DXTR.');
    const gateway = new OfficesDxtrGateway();
    const offices = await gateway.getOffices(context);
    const list = officesToCsv(offices);

    context.logger.info(MODULE_NAME, 'Writing mapped office records to CSV.');
    await fs.mkdir('./temp', { recursive: true });
    const file = await fs.open('./temp/OFFICES.csv', 'w');
    list.forEach((item) => file.write(item + '\n'));
    file.close();
  } catch (error) {
    context.logger.error(MODULE_NAME, error);
  } finally {
    context.logger.info(MODULE_NAME, 'Done.');
  }
}

if (require.main === module) {
  (async () => {
    await exportCsv();
  })();
}
