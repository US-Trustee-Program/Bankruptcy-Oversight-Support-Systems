import MigrateOrderIdsUseCase from './migrate-order-ids';
import Factory from '../../factory';
import { MigrationConsolidationOrder } from '../gateways.types';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';

describe('MigrateOrderIdsUseCase', () => {
  let mockContext: ApplicationContext;
  const mockRepo = {
    list: jest.fn(),
    set: jest.fn(),
  };
  let factorySpy;

  beforeEach(async () => {
    mockContext = await createMockApplicationContext();
    jest.clearAllMocks();
    mockRepo.list.mockReset();
    mockRepo.set.mockReset();

    factorySpy = jest
      .spyOn(Factory, 'getConsolidationOrdersMigrationMongoRepository')
      // @ts-expect-error mockRepo does not mock inherited functions.
      .mockReturnValue(mockRepo);
  });

  afterEach(() => {
    // Restore the original implementation
    factorySpy.mockRestore();
  });

  describe('migrateConsolidationOrderIds', () => {
    test('should group orders by jobId', async () => {
      // Arrange
      const mockOrders: MigrationConsolidationOrder[] = [
        { id: '1', jobId: 1000, status: 'pending' },
        { id: '2', jobId: 1000, status: 'approved' },
        { id: '3', jobId: 2000, status: 'rejected' },
      ];
      mockRepo.list.mockResolvedValue(mockOrders);

      // Act
      const result = await MigrateOrderIdsUseCase.migrateConsolidationOrderIds(mockContext);

      // Assert
      expect(Factory.getConsolidationOrdersMigrationMongoRepository).toHaveBeenCalledWith(
        mockContext,
      );
      expect(mockRepo.list).toHaveBeenCalled();
      expect(result).toEqual([
        [
          { id: '1', jobId: 1000, status: 'pending' },
          { id: '2', jobId: 1000, status: 'approved' },
        ],
        [{ id: '3', jobId: 2000, status: 'rejected' }],
      ]);
    });

    test('should handle empty orders list', async () => {
      // Arrange
      mockRepo.list.mockResolvedValue([]);

      // Act
      const result = await MigrateOrderIdsUseCase.migrateConsolidationOrderIds(mockContext);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('updateConsolidationIds', () => {
    test('should update consolidation IDs for all orders based on status', async () => {
      // Arrange
      const mockOrders: MigrationConsolidationOrder[] = [
        { id: '1', jobId: 1000, status: 'pending' },
        { id: '2', jobId: 1000, status: 'approved' },
        { id: '3', jobId: 1000, status: 'rejected' },
      ];

      // Act
      await MigrateOrderIdsUseCase.updateConsolidationIds(mockContext, mockOrders);

      // Assert
      expect(Factory.getConsolidationOrdersMigrationMongoRepository).toHaveBeenCalledWith(
        mockContext,
      );

      // Check that set was called for each order with correct parameters
      expect(mockRepo.set).toHaveBeenCalledTimes(3);
      expect(mockRepo.set).toHaveBeenCalledWith({ id: '1', consolidationId: '1000/pending' });
      expect(mockRepo.set).toHaveBeenCalledWith({ id: '2', consolidationId: '1000/approved/0' });
      expect(mockRepo.set).toHaveBeenCalledWith({ id: '3', consolidationId: '1000/rejected/0' });
    });

    test('should handle empty orders list', async () => {
      // Arrange
      const mockOrders: MigrationConsolidationOrder[] = [];

      // Act
      await MigrateOrderIdsUseCase.updateConsolidationIds(mockContext, mockOrders);

      // Assert
      expect(mockRepo.set).not.toHaveBeenCalled();
    });

    test('should process orders in correct order: pending, rejected, approved', async () => {
      // Arrange
      mockRepo.set.mockImplementation((params) => {
        return Promise.resolve(params);
      });

      const mockOrders: MigrationConsolidationOrder[] = [
        { id: '1', jobId: 1000, status: 'approved' },
        { id: '2', jobId: 1000, status: 'rejected' },
        { id: '3', jobId: 1000, status: 'pending' },
      ];

      // Act
      await MigrateOrderIdsUseCase.updateConsolidationIds(mockContext, mockOrders);

      // Assert
      expect(mockRepo.set).toHaveBeenCalledTimes(3);
      const calls = mockRepo.set.mock.calls.map((call) => call[0]);

      // First call should be pending order
      expect(calls[0]).toEqual({ id: '3', consolidationId: '1000/pending' });

      // Check that orders were processed in expected groups
      expect(
        calls.some((call) => call.id === '2' && call.consolidationId === '1000/rejected/0'),
      ).toBeTruthy();
      expect(
        calls.some((call) => call.id === '1' && call.consolidationId === '1000/approved/0'),
      ).toBeTruthy();
    });
  });

  describe('mapSetParameters', () => {
    test('should create consolidationId without index for pending status', () => {
      // This is testing the private function indirectly through updateConsolidationIds
      const mockOrder: MigrationConsolidationOrder = {
        id: '1',
        jobId: 1000,
        status: 'pending',
      };

      mockRepo.set.mockImplementation((params) => {
        return Promise.resolve(params);
      });

      // Act
      MigrateOrderIdsUseCase.updateConsolidationIds(mockContext, [mockOrder]);

      // Assert
      expect(mockRepo.set).toHaveBeenCalledWith({
        id: '1',
        consolidationId: '1000/pending',
      });
    });

    test('should include index in consolidationId for non-pending statuses', async () => {
      // Arrange
      const mockOrders: MigrationConsolidationOrder[] = [
        { id: '1', jobId: 1000, status: 'approved' },
        { id: '2', jobId: 1000, status: 'rejected' },
      ];

      mockRepo.set.mockImplementation((params) => {
        return Promise.resolve(params);
      });

      // Act
      await MigrateOrderIdsUseCase.updateConsolidationIds(mockContext, mockOrders);

      // Assert
      expect(mockRepo.set).toHaveBeenCalledWith({
        id: '1',
        consolidationId: '1000/approved/0',
      });
      expect(mockRepo.set).toHaveBeenCalledWith({
        id: '2',
        consolidationId: '1000/rejected/0',
      });
    });
  });
});
