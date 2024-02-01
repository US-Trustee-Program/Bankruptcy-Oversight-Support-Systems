import { getProperty } from '../../testing/mock-data';
import { ApplicationContext } from '../types/basic';
import { QueryResults } from '../types/database';
import { AttorneyListRecordSet, AttorneyListDbResult } from '../types/attorneys';
import { runQuery } from './inmemory.database.gateway';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

const MODULE_NAME = 'ATTORNEYS-INMEMORY-DB-GATEWAY';

const table = 'attorneys';

class AttorneyLocalGateway implements AttorneyGatewayInterface {
  public async getAttorneys(
    applicationContext: ApplicationContext,
    attorneyOptions: { officeId: string } = { officeId: '' },
  ): Promise<AttorneyListDbResult> {
    const input = [];

    const attorneyListRecords = await getProperty(table, 'list');
    if (
      !Object.prototype.hasOwnProperty.call(attorneyListRecords, 'attorneyList') ||
      !Array.isArray(attorneyListRecords.attorneyList)
    ) {
      throw new Error('Attorney mock data does not contain a valid attorneyList');
    }

    if (attorneyOptions.officeId.length > 0) {
      applicationContext.logger.info(MODULE_NAME, `${attorneyOptions.officeId}`);
      input.push({
        name: 'officeId',
        value: attorneyOptions.officeId,
      });
    }

    const queryResult: QueryResults = await runQuery(
      applicationContext,
      'attorneys',
      attorneyListRecords.attorneyList,
      input,
    );
    let results: AttorneyListDbResult;

    if (queryResult.success) {
      applicationContext.logger.info(MODULE_NAME, 'Attorney List DB query successful');
      const body: AttorneyListRecordSet = { attorneyList: [] };
      body.attorneyList = queryResult.results as [];
      const rowsAffected = (queryResult.results as Array<object>).length;
      results = {
        success: true,
        message: `${table} list`,
        count: rowsAffected,
        body,
      };
    } else {
      applicationContext.logger.warn(MODULE_NAME, 'Attorney List DB query unsuccessful');
      results = {
        success: false,
        message: queryResult.message,
        count: 0,
        body: { attorneyList: [] },
      };
    }

    return results;
  }
}

export { AttorneyLocalGateway };
