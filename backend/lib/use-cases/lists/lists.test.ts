import ListsUseCase from './lists';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ListsRepository } from '../gateways.types';
import Factory from '../../factory';
import { BankList, BankruptcySoftwareList } from '../../../../common/src/cams/lists';

describe('ListsUseCase tests', () => {
  let useCase: ListsUseCase;
  let context: ApplicationContext;
  let mockListsRepository: jest.Mocked<ListsRepository>;

  beforeEach(async () => {
    useCase = new ListsUseCase();
    context = await createMockApplicationContext();

    // Create mock repository
    mockListsRepository = {
      getBankruptcySoftwareList: jest.fn(),
      getBankList: jest.fn(),
      release: jest.fn(),
    };

    // Mock the factory to return our mock repository
    jest.spyOn(Factory, 'getListsGateway').mockReturnValue(mockListsRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(Factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankruptcySoftwareList).toHaveBeenCalled();
      expect(result).toEqual(mockSoftwareList);
    });

    test('should propagate errors from the repository', async () => {
      // Arrange
      const errorMessage = 'Failed to get bankruptcy software list';
      mockListsRepository.getBankruptcySoftwareList.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(useCase.getBankruptcySoftwareList(context)).rejects.toThrow(errorMessage);
      expect(Factory.getListsGateway).toHaveBeenCalledWith(context);
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
      expect(Factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankList).toHaveBeenCalled();
      expect(result).toEqual(mockBanksList);
    });

    test('should propagate errors from the repository', async () => {
      // Arrange
      const errorMessage = 'Failed to get banks list';
      mockListsRepository.getBankList.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(useCase.getBanksList(context)).rejects.toThrow(errorMessage);
      expect(Factory.getListsGateway).toHaveBeenCalledWith(context);
      expect(mockListsRepository.getBankList).toHaveBeenCalled();
    });
  });
});
