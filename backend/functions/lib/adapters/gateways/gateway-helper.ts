import * as fs from 'fs';
import { CaseDetailInterface } from '../types/cases';
import { QueryResults } from '../types/database';
import { ApplicationContext } from '../types/basic';
import { CamsError } from '../../common-errors/cams-error';

export class GatewayHelper {
  getAllCasesMockExtract(): CaseDetailInterface[] {
    const filename = './lib/testing/mock-data/cases.mock.json';

    try {
      const data = fs.readFileSync(filename, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      throw Error(err);
    }
  }
}

export function handleQueryResult<T>(
  context: ApplicationContext,
  queryResult: QueryResults,
  moduleName: string,
  callback: (context: ApplicationContext, queryResult: QueryResults) => T,
): T {
  if (queryResult.success) {
    return callback(context, queryResult);
  } else {
    throw new CamsError(moduleName, { message: queryResult.message });
  }
}
