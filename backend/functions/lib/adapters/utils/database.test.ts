describe('Tests database', () => {
  test('???', async () => {
    // setup test
    jest.mock('mssql', () => ({
      ConnectionPool: {
        connect: jest.fn().mockImplementation(() => ({
          request: jest.fn(),
          query: jest.fn().mockImplementation(() => 'test string'),
        })),
      },
    }));
    // execute method under test

    // assert
  });
});
