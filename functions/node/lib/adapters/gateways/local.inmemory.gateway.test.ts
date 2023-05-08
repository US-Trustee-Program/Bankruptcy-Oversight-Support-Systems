const context = require('azure-function-context-mock');
import { DbResult } from '../types/database.js';
import { getProperty } from '../../testing/mock-data/';
import * as db from './local.inmemory.gateway';
import { RecordObj } from '../types/basic.js';

const table = 'generic_test_data';

describe('Local in-memory database gateway tests', () => {
  let list: any;

  beforeEach(async () => {
    list = await getProperty(table, 'list');
  })

  afterEach(() => {
    list = null;
  })

  test('Fetching all records on a given table returns the expected results', async () => {
    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length,
      body: list,
    };

    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });

  test('Fetching specific record on a given table returns 1 result', async () => {
    list = list.filter(rec => (rec.generic_test_data_id === 7));

    const mockResults: DbResult = {
      success: true,
      message: `${table} record`,
      count: 1,
      body: list
    };

    const results = await db.getRecord(context, table, 7);

    expect(results).toEqual(mockResults);
  });

  test('Creating a record returns expected result and adds one record to the database', async () => {
    const fields: RecordObj[] = [
      {
        fieldName: 'generic_test_data_id',
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
      body: list
    };

    await db.createRecord(context, table, fields);
    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);

    const newRecord = list.filter(rec => (rec.generic_test_data_id === 10));
    expect(newRecord).toEqual([{
      generic_test_data_id: 10,
      b: 11,
      c: 12,
    }]);
  });

  test('Updating a record returns expected result and alters one record in the database', async () => {
    const fields: RecordObj[] = [
      {
        fieldName: 'generic_test_data_id',
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
        generic_test_data_id: 7,
        b: 1,
        c: 2,
      }
    };

    const updateResults = await db.updateRecord(context, table, 7, fields);
    const fullList = await db.getAll(context, table);

    expect(updateResults).toEqual(mockUpdateResults);
    expect(fullList.count).toEqual(list.length);
    expect((fullList.body as []).length).toEqual(list.length);
  });

  test('Deleteing a record returns expected result and removes one record from the database', async () => {
    const newList = list.filter(rec => (rec.generic_test_data_id != 7));

    const mockResults: DbResult = {
      success: true,
      message: `${table} list`,
      count: list.length - 1,
      body: newList
    };

    await db.deleteRecord(context, table, 7);
    const results = await db.getAll(context, table);

    expect(results).toEqual(mockResults);
  });
});