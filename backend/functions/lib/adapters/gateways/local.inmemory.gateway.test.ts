const context = require('azure-function-context-mock');
import { DbResult } from '../types/database';
import { getProperty } from '../../testing/mock-data/index';
import * as db from './local.inmemory.gateway';
import { RecordObj } from '../types/basic';

const table = 'generic-test-data';

describe('Local in-memory database gateway tests', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  });

  afterEach(() => {
    list = null;
  });

  test('Should return all records when fetching all records on a given table', async () => {
    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length,
      body: list,
    };

    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });

  test('Should return 1 result when fetching specific record on a given table', async () => {
    list = list.filter((rec) => rec['generic-test-data_id'] === 7);

    const mockResults: DbResult = {
      success: true,
      message: `${table} record`,
      count: 1,
      body: list,
    };

    const results = await db.getRecord(context, table, 7);

    expect(results).toEqual(mockResults);
  });

  test('Should add one record to the database and returns expected result when creating a record', async () => {
    const fields: RecordObj[] = [
      {
        fieldName: 'generic-test-data_id',
        fieldValue: 10,
      },
      {
        fieldName: 'b',
        fieldValue: 11,
      },
      {
        fieldName: 'c',
        fieldValue: 12,
      },
    ];

    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length + 1,
      body: list,
    };

    await db.createRecord(context, table, fields);
    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);

    const newRecord = list.filter((rec) => rec['generic-test-data_id'] === 10);
    expect(newRecord).toEqual([
      {
        'generic-test-data_id': 10,
        b: 11,
        c: 12,
      },
    ]);
  });

  test('Should alter 1 record in the database when Updating a record', async () => {
    const fields: RecordObj[] = [
      {
        fieldName: 'generic-test-data_id',
        fieldValue: 7,
      },
      {
        fieldName: 'b',
        fieldValue: 1,
      },
      {
        fieldName: 'c',
        fieldValue: 2,
      },
    ];

    const mockUpdateResults: DbResult = {
      success: true,
      message: '',
      count: 1,
      body: {
        'generic-test-data_id': 7,
        b: 1,
        c: 2,
      },
    };

    const updateResults = await db.updateRecord(context, table, 7, fields);
    const fullList = await db.getAll(context, table);

    expect(updateResults).toEqual(mockUpdateResults);
    expect(fullList.count).toEqual(list.length);
    expect((fullList.body as []).length).toEqual(list.length);
  });

  test('Should remove 1 record from the dataset when Deleteing a record', async () => {
    const newList = list.filter((rec) => rec['generic-test-data_id'] != 7);

    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length - 1,
      body: newList,
    };

    await db.deleteRecord(context, table, 7);
    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });
});
