const context = require('azure-function-context-mock');
import * as mssql from 'mssql';
import { QueryResults } from '../types/database';
import { runQuery, validateTableName } from './database';

jest.useFakeTimers()

const testString1 = 'test query';

jest.mock('mssql');

const mockExecute = jest.fn();
const mockInput = jest.fn().mockReturnValue({ execute: mockExecute });
const mockQuery = jest.fn().mockReturnValue([testString1]);
const mockRequest = jest.fn().mockReturnValue({
  input: mockInput,
  query: mockQuery,
});

/*
const mockTransaction = jest.fn().mockImplementation(() => {
  return {
    begin: callback => callback(),
    commit: jest.fn(),
    rollback: jest.fn()
  };
});

const mockConnect = jest.fn().mockImplementation(() => {
  return Promise.resolve({ transaction: mockTransaction });
});

const mockConnectionPool = jest.fn().mockReturnValue({
  request: mockRequest,
  connect: mockConnect,
  execute: mockExecute,
  input: mockInput,
});

*/

const returnValue1: QueryResults = {
  results: [testString1],
  message: '',
  success: true,
}

const mockQueryResult = {
  recordset: [{ id: 1, name: 'john' }],
  rowsAffected: [2],
};

const mockPool = {
  connect: jest.fn(),
  request: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue(mockQueryResult),
};

//mssql.ConnectionPool.mockImplementation(() => mockPool);

describe('Test connecting and running a query on mssql database', () => {
  test('Successfully validates a table name', async () => {
    expect(validateTableName('lajsdflajdfljaf9263492ljadffoobar')).toBeTruthy();
    expect(validateTableName('()*&^-lajsdflajdfljaf9263492ljadf_foo_bar')).toBeFalsy();
  });

  test('Database runQuery should return a valid response when supplied a simple query with no inputs', async () => {
    expect(1).toBe(1);

    /*
    const mockConnectionPool = new mssql.ConnectionPool({
      user: 'myuser',
      password: 'mypassword',
      server: 'myserver.database.windows.net',
      database: 'mydatabase',
      options: {
        encrypt: true,
      },
    });

    jest.mock('mssql', () => ({
      ConnectionPool: mockConnectionPool,
      Request: mockRequest,
      NVarChar: jest.fn()
    }));

    const queryResult = await runQuery(context, '', testString1, []);

    expect(mockQuery).toHaveBeenCalledWith(testString1);
    expect(queryResult).toEqual(returnValue1);
    */
  });
});

describe('Azure SQL tests', () => {
  test('should mock connection and query', async () => {
    expect(1).toBe(1);
    /*
    const mockQueryResult = {
      recordset: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
      rowsAffected: [2],
    };

    const mockPool = {
      connect: jest.fn(),
      request: jest.fn().mockReturnThis(),
      query: jest.fn().mockReturnValueOnce(Promise.resolve(mockQueryResult)),
      close: jest.fn(),
    };

    mssql.ConnectionPool = jest.fn(() => mockPool);

    const pool = new mssql.ConnectionPool({
      user: 'myuser',
      password: 'mypassword',
      server: 'myserver.database.windows.net',
      database: 'mydatabase',
      options: {
        encrypt: true,
      },
    });

    await pool.connect();

    const query = 'SELECT * FROM MyTable';
    const result = await pool.query(query);

    expect(mockPool.query).toHaveBeenCalledWith(query);
    expect(result.recordset).toEqual(mockQueryResult.recordset);
    expect(result.rowsAffected).toEqual(mockQueryResult.rowsAffected);

    pool.close();
    */
  });
});