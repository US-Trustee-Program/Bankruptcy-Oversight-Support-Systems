import { vi, Mocked } from 'vitest';
import ListsUseCase from './lists';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ListsRepository } from '../gateways.types';
import factory from '../../factory';
import { BankList, BankruptcySoftwareList, BankListItem } from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';

describe('ListsUseCase tests', () => {
  let useCase: ListsUseCase;
  let context: ApplicationContext;
  let mockListsRepository: Mocked<ListsRepository>;

  beforeEach(async () => {
    useCase = new ListsUseCase();
    context = await createMockApplicationContext();

    // Create mock repository
    mockListsRepository = {
      getBankruptcySoftwareList: vi.fn(),
      getBankList: vi.fn(),
      postBank: vi.fn(),
      deleteBank: vi.fn(),
      release: vi.fn(),
    };

    // Mock the factory to return our mock repository
    vi.spyOn(factory, 'getListsGateway').mockReturnValue(mockListsRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBankruptcySoftwareList', () => {
    test('should return bankruptcy software list from the repository', async () => {
      // Arrange
      const mockSoftwareList: BankruptcySoftwareList = [
        { _id: '1', list: 'bankruptcy-software', key: 'software1', value: 'Software One' },
        { _id: '2', list: 'bankruptcy-software', key: 'software2', value: 'Software Two' },
      ];
      mockListsRepository.getBankruptcySoftwareList.mockResolvedValue(mockSoftwareList);

      // Act
      const result = await useCase.getBankruptcySoftwareList(context);

      // Assert
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankruptcySoftwareList).toHaveBeenCalled();
      expect(result).toEqual(mockSoftwareList);
    });

    test('should return bankruptcy software list sorted by value', async () => {
      // Arrange - Create unsorted mock data
      const mockUnsortedSoftwareList: BankruptcySoftwareList = [
        { _id: '3', list: 'bankruptcy-software', key: 'software3', value: 'Zebra Software' },
        { _id: '1', list: 'bankruptcy-software', key: 'software1', value: 'Alpha Software' },
        { _id: '2', list: 'bankruptcy-software', key: 'software2', value: 'Beta Software' },
      ];
      mockListsRepository.getBankruptcySoftwareList.mockResolvedValue(mockUnsortedSoftwareList);

      // Act
      const result = await useCase.getBankruptcySoftwareList(context);

      // Assert - Verify the result is sorted by value
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankruptcySoftwareList).toHaveBeenCalled();
      expect(result).toHaveLength(3);
      expect(result[0].value).toBe('Alpha Software');
      expect(result[1].value).toBe('Beta Software');
      expect(result[2].value).toBe('Zebra Software');

      // Additional verification that the sorting is correct
      const sortedValues = result.map((item) => item.value);
      const expectedSortedValues = ['Alpha Software', 'Beta Software', 'Zebra Software'];
      expect(sortedValues).toEqual(expectedSortedValues);
    });

    test('should propagate errors from the repository', async () => {
      // Arrange
      const errorMessage = 'Failed to get bankruptcy software list';
      mockListsRepository.getBankruptcySoftwareList.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(useCase.getBankruptcySoftwareList(context)).rejects.toThrow(errorMessage);
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankruptcySoftwareList).toHaveBeenCalled();
    });
  });

  describe('getBanksList', () => {
    test('should return banks list from the repository', async () => {
      // Arrange
      const mockBanksList: BankList = [
        { _id: '1', list: 'banks', key: 'bank1', value: 'Bank One' },
        { _id: '2', list: 'banks', key: 'bank2', value: 'Bank Two' },
      ];
      mockListsRepository.getBankList.mockResolvedValue(mockBanksList);

      // Act
      const result = await useCase.getBanksList(context);

      // Assert
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankList).toHaveBeenCalled();
      expect(result).toEqual(mockBanksList);
    });

    test('should propagate errors from the repository', async () => {
      // Arrange
      const errorMessage = 'Failed to get banks list';
      mockListsRepository.getBankList.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(useCase.getBanksList(context)).rejects.toThrow(errorMessage);
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankList).toHaveBeenCalled();
    });
  });

  describe('createBank', () => {
    test('should create bank item through the repository', async () => {
      // Arrange
      const mockItemId = '67890';
      const itemToCreate: Creatable<BankListItem> = {
        list: 'banks',
        key: 'new-bank',
        value: 'New Bank',
      };
      mockListsRepository.postBank.mockResolvedValue(mockItemId);

      // Act
      const result = await useCase.createBank(context, itemToCreate);

      // Assert
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.postBank).toHaveBeenCalledWith(itemToCreate);
      expect(result).toEqual(mockItemId);
    });

    test('should propagate errors from the repository', async () => {
      // Arrange
      const errorMessage = 'Failed to create bank';
      const itemToCreate: Creatable<BankListItem> = {
        list: 'banks',
        key: 'new-bank',
        value: 'New Bank',
      };
      mockListsRepository.postBank.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(useCase.createBank(context, itemToCreate)).rejects.toThrow(errorMessage);
      expect(factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.postBank).toHaveBeenCalledWith(itemToCreate);
    });
  });
});
