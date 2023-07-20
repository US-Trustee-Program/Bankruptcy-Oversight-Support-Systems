import log from '../services/logger.service';
import { getProperty } from '../../testing/mock-data';
import { ApplicationContext } from '../types/basic';
import { QueryResults } from '../types/database';
import { AttorneyListRecordSet, AttorneyListDbResult } from '../types/attorneys';
import { runQuery } from './local.inmemory.gateway';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

const NAMESPACE = 'ATTORNEYS-LOCAL-INMEMORY-DB-GATEWAY';

const table = 'attorneys';

class AttorneyLocalGateway implements AttorneyGatewayInterface {
  public async getAttorneys(
    context: ApplicationContext,
    attorneyOptions: { officeId: string } = { officeId: '' },
  ): Promise<AttorneyListDbResult> {
    let attorneyListRecords: AttorneyListRecordSet;
    let input = [];

    attorneyListRecords = await getProperty(table, 'list');
    if (
      !Object.prototype.hasOwnProperty.call(attorneyListRecords, 'attorneyList') ||
      !Array.isArray(attorneyListRecords.attorneyList)
    ) {
      throw new Error('Attorney mock data does not contain a valid attorneyList');
    }

    if (attorneyOptions.officeId.length > 0) {
      log.info(context, NAMESPACE, `${attorneyOptions.officeId}`);
      input.push({
        name: 'officeId',
        value: attorneyOptions.officeId,
      });
    }

    const queryResult: QueryResults = await runQuery(
      context,
      'attorneys',
      attorneyListRecords.attorneyList,
      input,
    );
    let results: AttorneyListDbResult;

    if (queryResult.success) {
      log.info(context, NAMESPACE, 'Attorney List DB query successful');
      const body: AttorneyListRecordSet = { attorneyList: [] };
      body.attorneyList = queryResult.results as [];
      const rowsAffected = (queryResult.results as Array<{}>).length;
      results = {
        success: true,
        message: `${table} list`,
        count: rowsAffected,
        body,
      };
    } else {
      log.warn(context, NAMESPACE, 'Attorney List DB query unsuccessful');
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
