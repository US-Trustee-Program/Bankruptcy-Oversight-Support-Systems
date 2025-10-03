import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { ListsController } from './lists.controller';
import {
  BankList,
  BankruptcySoftwareList,
  BankListItem,
  BankruptcySoftwareListItem,
} from '../../../../common/src/cams/lists';
import { Creatable } from '../../../../common/src/cams/creatable';

// Mock the ListsUseCase methods
let getBanksList = jest.fn();
let getBankruptcySoftwareList = jest.fn();
let createBank = jest.fn();
let createBankruptcySoftware = jest.fn();

jest.mock('../../use-cases/lists/lists', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        getBanksList,
        getBankruptcySoftwareList,
        createBank,
        createBankruptcySoftware,
      };
    }),
  };
});

describe('lists controller tests', () => {
  let applicationContext: ApplicationContext;

  // Mock data for tests
  const mockBanksList: BankList = [
    { _id: '1', list: 'banks', key: 'bank1', value: 'Bank One' },
    { _id: '2', list: 'banks', key: 'bank2', value: 'Bank Two' },
  ];

  const mockSoftwareList: BankruptcySoftwareList = [
    { _id: '3', list: 'bankruptcy-software', key: 'software1', value: 'Software One' },
    { _id: '4', list: 'bankruptcy-software', key: 'software2', value: 'Software Two' },
  ];

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return successful response for banks list', async () => {
    getBanksList = jest.fn().mockResolvedValue(mockBanksList);

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'banks' },
    });

    const response = await controller.handleRequest(applicationContext);

    expect(getBanksList).toHaveBeenCalledWith(applicationContext);
    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: mockBanksList,
        },
      }),
    );
  });

  test('should return successful response for bankruptcy-software list', async () => {
    getBankruptcySoftwareList = jest.fn().mockResolvedValue(mockSoftwareList);

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'bankruptcy-software' },
    });

    const response = await controller.handleRequest(applicationContext);

    expect(getBankruptcySoftwareList).toHaveBeenCalledWith(applicationContext);
    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: mockSoftwareList,
        },
      }),
    );
  });

  test('should throw error for invalid list name', async () => {
    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'invalid-list' },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');
  });

  test('should throw CamsError when one is caught from use case', async () => {
    getBanksList = jest
      .fn()
      .mockRejectedValue(
        new CamsError('LISTS-CONTROLLER', { message: 'Failed to retrieve banks list' }),
      );

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'banks' },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Failed to retrieve banks list');
  });

  test('should wrap unexpected error in UnknownError', async () => {
    getBankruptcySoftwareList = jest.fn().mockRejectedValue(new Error('Some unknown error'));

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'bankruptcy-software' },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');
  });

  test('should create bank item and return ID on POST', async () => {
    const bankId = '123456';
    createBank = jest.fn().mockResolvedValue(bankId);

    const bankItem: Creatable<BankListItem> = {
      list: 'banks' as const,
      key: 'test-bank',
      value: 'Test Bank',
    };

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { listName: 'banks' },
      body: bankItem,
    });

    const response = await controller.handleRequest(applicationContext);

    expect(createBank).toHaveBeenCalledWith(applicationContext, bankItem);
    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: { _id: bankId },
        },
      }),
    );
  });

  test('should create bankruptcy software item and return ID on POST', async () => {
    const softwareId = '789012';
    createBankruptcySoftware = jest.fn().mockResolvedValue(softwareId);

    const softwareItem: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software' as const,
      key: 'test-software',
      value: 'Test Software',
    };

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { listName: 'bankruptcy-software' },
      body: softwareItem,
    });

    const response = await controller.handleRequest(applicationContext);

    expect(createBankruptcySoftware).toHaveBeenCalledWith(applicationContext, softwareItem);
    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: { _id: softwareId },
        },
      }),
    );
  });
});
