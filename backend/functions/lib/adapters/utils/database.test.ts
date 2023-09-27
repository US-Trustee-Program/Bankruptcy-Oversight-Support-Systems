type sqlConnect = {
  request: () => void;
  query: () => void;
};

function mssqlMock() {
  return class ConnectionPool {
    public connect = jest.fn().mockImplementation(
      (): Promise<sqlConnect> =>
        Promise.resolve({
          request: jest.fn(),
          query: jest
            .fn()
            .mockImplementation((): Promise<string> => Promise.resolve('test string')),
        }),
    );
  };
}

describe('Tests database', () => {
  test('???', async () => {
    // setup test
    jest.mock('mssql', mssqlMock);
    // execute method under test

    // assert
  });
});
