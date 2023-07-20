const context = require('azure-function-context-mock');
import { applicationContextCreator } from '../utils/application-context-creator';
import { AttorneyLocalGateway } from './attorneys.local.inmemory.gateway';
import * as testingMockData from '../../testing/mock-data';
import * as localInmemoryGateway from './local.inmemory.gateway';

describe('Local in-memory database gateway tests specific to attorneys list', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Should throw an error if getProperty return value does not contain attorneyList array.', async () => {
    jest.spyOn(testingMockData, 'getProperty').mockResolvedValue({
      foo: 'bar',
    });

    const gateway = new AttorneyLocalGateway();

    const mockContext = applicationContextCreator(context);

    try {
      await gateway.getAttorneys(mockContext, { officeId: 'no-op' });
    } catch (e) {
      expect(e).toEqual(Error('Attorney mock data does not contain a valid attorneyList'));
    }
  });

  it('Should call runQuery with input including office id if office id is passed to getAttorneys()', async () => {
    const officeId = '123';

    const runQuerySpy = jest.spyOn(localInmemoryGateway, 'runQuery');
    const gateway = new AttorneyLocalGateway();
    const mockContext = applicationContextCreator(context);

    jest.mock('../../testing/mock-data/index', () => ({
      getProperty: jest.fn(() => ({ attorneyList: [{ foo: 'foo' }] })),
    }));

    await gateway.getAttorneys(mockContext, { officeId });

    expect(runQuerySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining([{ name: 'officeId', value: '123' }]),
    );
  });

  it('Should call runQuery with no input if office id is not passed to getAttorneys()', async () => {
    const officeId = '';

    const runQuerySpy = jest.spyOn(localInmemoryGateway, 'runQuery');
    const gateway = new AttorneyLocalGateway();
    const mockContext = applicationContextCreator(context);

    jest.mock('../../testing/mock-data/index', () => ({
      getProperty: jest.fn(() => ({ attorneyList: [{ foo: 'foo' }] })),
    }));

    await gateway.getAttorneys(mockContext, { officeId });

    expect(runQuerySpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining([{ name: 'officeId' }]),
    );
  });

  it('Should return a failed status and an error message when runQuery returns a failed query', async () => {
    const gateway = new AttorneyLocalGateway();
    const mockContext = applicationContextCreator(context);

    jest.spyOn(localInmemoryGateway, 'runQuery').mockResolvedValue({
      success: false,
      message: 'Test Error',
      results: [],
    });

    jest.mock('../../testing/mock-data/index', () => ({
      getProperty: jest.fn(() => ({ attorneyList: [{ foo: 'foo' }] })),
    }));

    const result = await gateway.getAttorneys(mockContext, { officeId: '' });

    expect(result).toEqual({
      success: false,
      message: 'Test Error',
      count: 0,
      body: { attorneyList: [] },
    });
  });

  it('Should return a set of 4 results when all is well', async () => {
    const gateway = new AttorneyLocalGateway();
    const mockContext = applicationContextCreator(context);

    const mockList = [{ foo: '1' }, { foo: '2' }, { foo: '3' }];
    jest.spyOn(localInmemoryGateway, 'runQuery').mockResolvedValue({
      success: true,
      message: '',
      results: mockList,
    });

    const result = await gateway.getAttorneys(mockContext, { officeId: '' });

    expect(result).toEqual({
      success: true,
      message: 'attorneys list',
      count: 3,
      body: { attorneyList: mockList },
    });
  });

  it('Should return a set of 4 results when all is well and no options parameter was supplied', async () => {
    const gateway = new AttorneyLocalGateway();
    const mockContext = applicationContextCreator(context);

    const mockList = [{ foo: '1' }, { foo: '2' }, { foo: '3' }];
    jest.spyOn(localInmemoryGateway, 'runQuery').mockResolvedValue({
      success: true,
      message: '',
      results: mockList,
    });

    const result = await gateway.getAttorneys(mockContext);

    expect(result).toEqual({
      success: true,
      message: 'attorneys list',
      count: 3,
      body: { attorneyList: mockList },
    });
  });
});
