import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MockHumbleItem, MockHumbleItems } from '../../../testing/mock.cosmos-client-humble';
import { ApplicationContext } from '../../types/basic';
import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { ErrorResponse } from '@azure/cosmos';
import { ID_ALREADY_EXISTS } from './cosmos.helper';
import { DocumentRepository } from '../../../use-cases/gateways.types';
import { CosmosDbRepository } from './cosmos.repository';
import { UnknownError } from '../../../common-errors/unknown-error';

interface TestType {
  id?: string;
  something: number;
}

const moduleName = 'COSMOS_TEST';
describe('Test generic cosmosdb repository', () => {
  let mockDbContext: ApplicationContext;
  let cosmosCrudRepo: DocumentRepository<TestType>;

  beforeEach(async () => {
    mockDbContext = await createMockApplicationContext();
    cosmosCrudRepo = new CosmosDbRepository<TestType>(mockDbContext, 'cases', moduleName);
  });

  test('should get ServerConfigError', async () => {
    const error = new AggregateAuthenticationError([]);
    const expectedError = new ServerConfigError(moduleName, {
      message: 'Failed to authenticate to Azure',
    });
    jest.spyOn(MockHumbleItem.prototype, 'read').mockRejectedValue(error);
    await expect(cosmosCrudRepo.get(mockDbContext, '', '')).rejects.toThrow(expectedError);
  });

  test('should get mocked item', async () => {
    const mockItem: TestType = {
      id: '123',
      something: 456,
    };
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: mockItem,
    });

    const testResult = await cosmosCrudRepo.get(mockDbContext, mockItem.id, mockItem.id);
    expect(testResult).toEqual(mockItem);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should get updated item', async () => {
    const updatedItem: TestType = {
      id: '789',
      something: 42,
    };

    const mockReplace = jest
      .spyOn(MockHumbleItem.prototype, 'replace')
      .mockResolvedValue({ resource: updatedItem });
    const actual = await cosmosCrudRepo.update(
      mockDbContext,
      updatedItem.id,
      updatedItem.id,
      updatedItem,
    );
    expect(actual).toEqual(updatedItem);
    expect(mockReplace).toHaveBeenCalled();
  });

  test('should put new item', async () => {
    const newItem: TestType = {
      something: 42,
    };
    const expectedItem = {
      ...newItem,
      id: 'mockId',
    };

    const mockCreate = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockResolvedValue({ resource: expectedItem });
    const actual = await cosmosCrudRepo.put(mockDbContext, newItem);
    expect(actual).toEqual(expectedItem);
    expect(mockCreate).toHaveBeenCalled();
  });

  test('should delete new item', async () => {
    const itemToDelete: TestType = {
      id: '789',
      something: 42,
    };

    const mockDelete = jest
      .spyOn(MockHumbleItem.prototype, 'delete')
      .mockResolvedValue({ resource: itemToDelete });
    const actual = await cosmosCrudRepo.delete(mockDbContext, itemToDelete.id, itemToDelete.id);
    expect(actual).toEqual(itemToDelete);
    expect(mockDelete).toHaveBeenCalled();
  });

  test('should create new items', async () => {
    const items: TestType[] = [
      {
        something: 42,
      },
      {
        id: '789',
        something: 42,
      },
    ];

    const expectedItems = [items[0]];

    const existingError = new ErrorResponse();
    existingError.body = {
      code: '',
      message: ID_ALREADY_EXISTS,
    };

    const mockCreate = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockImplementation(async (record: TestType): Promise<{ resource: unknown }> => {
        return record.id ? Promise.reject(existingError) : Promise.resolve({ resource: record });
      });

    const actual = await cosmosCrudRepo.putAll(mockDbContext, items);
    expect(actual).toEqual(expectedItems);
    expect(mockCreate).toHaveBeenCalled();
  });

  test('should return early when no items are passed in', async () => {
    const items: TestType[] = [];
    const mockCreate = jest.spyOn(MockHumbleItems.prototype, 'create');

    const actual = await cosmosCrudRepo.putAll(mockDbContext, items);
    expect(actual).toEqual(items);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('should throw any other error when putting items', async () => {
    const items: TestType[] = [
      {
        something: 42,
      },
      {
        id: '789',
        something: 42,
      },
    ];

    const otherError = new Error('mock error');
    const camsError = new UnknownError(moduleName, { originalError: otherError });

    const mockCreate = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockRejectedValueOnce(otherError);

    await expect(cosmosCrudRepo.putAll(mockDbContext, items)).rejects.toThrow(camsError);
    expect(mockCreate).toHaveBeenCalled();
  });
});
