/*
// mssql-mock.js
const mssql = jest.genMockFromModule('mssql');

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

class ConnectionPool {
  public config;

  constructor(config) {
    this.config = config;
  }

  async connect() {
    return Promise.resolve();
  }

  request() {
    return mockPool.request();
  }

  async query(query) {
    return mockPool.query(query);
  }

  async close() {
    return Promise.resolve();
  }
}

mssql.ConnectionPool = ConnectionPool;

module.exports = mssql;
*/
