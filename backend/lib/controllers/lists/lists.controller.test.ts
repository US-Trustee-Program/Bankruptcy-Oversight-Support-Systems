import { vi } from 'vitest';
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
} from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';
import ListsUseCase from '../../use-cases/lists/lists';

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
    vi.restoreAllMocks();
  });

  test('should return successful response for banks list', async () => {
    vi.spyOn(ListsUseCase.prototype, 'getBanksList').mockResolvedValue(mockBanksList);

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'banks' },
    });

    const response = await controller.handleRequest(applicationContext);

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
    vi.spyOn(ListsUseCase.prototype, 'getBankruptcySoftwareList').mockResolvedValue(
      mockSoftwareList,
    );

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      params: { listName: 'bankruptcy-software' },
    });

    const response = await controller.handleRequest(applicationContext);

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
    vi.spyOn(ListsUseCase.prototype, 'getBanksList').mockRejectedValue(
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
    vi.spyOn(ListsUseCase.prototype, 'getBankruptcySoftwareList').mockRejectedValue(
      new Error('Some unknown error'),
    );

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
    vi.spyOn(ListsUseCase.prototype, 'createBank').mockResolvedValue(bankId);

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
    vi.spyOn(ListsUseCase.prototype, 'createBankruptcySoftware').mockResolvedValue(softwareId);

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

    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: { _id: softwareId },
        },
      }),
    );
  });

  test('should delete bankruptcy software item successfully on DELETE', async () => {
    const deleteSpy = vi
      .spyOn(ListsUseCase.prototype, 'deleteBankruptcySoftware')
      .mockResolvedValue(undefined);

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: { listName: 'bankruptcy-software', id: 'test-id-123' },
    });

    const response = await controller.handleRequest(applicationContext);

    expect(deleteSpy).toHaveBeenCalledWith(applicationContext, 'test-id-123');
    expect(response).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: undefined,
        },
      }),
    );
  });

  test('should throw error when ID is missing for DELETE bankruptcy-software', async () => {
    const deleteSpy = vi.spyOn(ListsUseCase.prototype, 'deleteBankruptcySoftware');

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: { listName: 'bankruptcy-software' },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  test('should throw error when ID is empty string for DELETE bankruptcy-software', async () => {
    const deleteSpy = vi.spyOn(ListsUseCase.prototype, 'deleteBankruptcySoftware');

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: { listName: 'bankruptcy-software', id: '   ' },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  test('should throw error when ID is not a string for DELETE bankruptcy-software', async () => {
    const deleteSpy = vi.spyOn(ListsUseCase.prototype, 'deleteBankruptcySoftware');

    const controller = new ListsController();
    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: { listName: 'bankruptcy-software', id: 123 as unknown as string },
    });

    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
