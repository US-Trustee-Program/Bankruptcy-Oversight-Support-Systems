import log from '../services/logger.service';
import { attorneyListMockData, getProperty } from '../../testing/mock-data';
import { ApplicationContext } from '../types/basic';
import { QueryResults } from '../types/database';
import { AttorneyListRecordSet, AttorneyListDbResult } from '../types/attorneys';
import { runQuery } from './local.inmemory.gateway';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

const NAMESPACE = 'ATTORNEYS-LOCAL-INMEMORY-DB-GATEWAY';

const table = 'attorneys';

class AttorneyLocalGateway implements AttorneyGatewayInterface {
  private async initializeAttorneys(): Promise<AttorneyListRecordSet> {
    let attorneyListRecords: AttorneyListRecordSet;

    if (attorneyListMockData.attorneys.initialized) {
      return attorneyListMockData[table];
    } else {
      attorneyListRecords = await getProperty(table, 'list');
      attorneyListRecords.initialized = true;
      attorneyListMockData[table] = attorneyListRecords;
    }

    return attorneyListRecords;
  }

  public async getAttorneys(
    context: ApplicationContext,
    attorneyOptions: { officeId: string } = { officeId: '' },
  ): Promise<AttorneyListDbResult> {
    let attorneyListRecords: AttorneyListRecordSet;
    let input = [];

    attorneyListRecords = await this.initializeAttorneys();

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
