type sqlConnect = {
  request: () => void;
  query: () => void;
}
describe('Tests database', () => {
  test('???', async () => {
    // setup test
    jest.mock('mssql', () => ({
      ConnectionPool: {
        connect: jest.fn().mockImplementation((): Promise<sqlConnect> => (Promise.resolve({
          request: jest.fn(),
          query: jest.fn().mockImplementation((): Promise<string> => Promise.resolve('test string')),
        }))),
      },
    }));
    // execute method under test

    // assert
  });
});
