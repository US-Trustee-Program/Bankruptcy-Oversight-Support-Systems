import log from '../services/logger.service';
import { attorneyListMockData, getProperty } from '../../testing/mock-data';
import { Context } from '../types/basic';
import { DbResult, QueryResults } from '../types/database';
import { AttorneyListRecordSet } from '../types/attorneys';
import { runQuery } from './local.inmemory.gateway';
import { getRecord, createRecord, updateRecord, deleteRecord } from './local.inmemory.gateway';

const NAMESPACE = 'ATTORNEYS-LOCAL-INMEMORY-DB-GATEWAY';

const table = 'attorneys';

async function initializeAttorneys(): Promise<AttorneyListRecordSet> {
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

const getAttorneyList = async (
  context: Context,
  attorneyOptions: { officeId: string } = { officeId: '' },
): Promise<DbResult> => {
  let attorneyListRecords: AttorneyListRecordSet;
  let input = [];

  attorneyListRecords = await initializeAttorneys();

  log.info(context, NAMESPACE, `${attorneyOptions.officeId}`);

  if (attorneyOptions.officeId && attorneyOptions.officeId.length > 0) {
    input.push({
      name: 'officeId',
      value: attorneyOptions.officeId,
    });
  }

  const queryResult: QueryResults = await runQuery(context, '', attorneyListRecords.list, input);
  let results: DbResult;

  if (queryResult.success) {
    log.info(context, NAMESPACE, 'Attorney List DB query successful');
    const body = { list: {} };
    body.list = queryResult.results as Object;
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
      body: {},
    };
  }

  return results;
};

export { getAttorneyList };
