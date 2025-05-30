import { jest } from '@jest/globals';
import ConsolidationOrdersMigrationMongoRepository from './consolidations-migration.mongo.repository';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import {
  MigrationConsolidationOrder,
  UpdateConsolidationId,
} from '../../../use-cases/gateways.types';
import QueryPipeline from '../../../query/query-pipeline';

describe('ConsolidationOrdersMigrationMongoRepository', () => {
  let mockContext: ApplicationContext;
  let repository: ConsolidationOrdersMigrationMongoRepository;
  let mockAdapter;

  beforeEach(async () => {
    jest.spyOn(global.crypto, 'randomUUID').mockReturnValue('0-0-0-0-0');
    mockContext = await createMockApplicationContext();
    repository = ConsolidationOrdersMigrationMongoRepository.getInstance(mockContext);

    // Mock the adapter methods
    mockAdapter = {
      aggregate: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    // Mock getAdapter to return our mock adapter
    // @ts-expect-error - Accessing protected property for testing
    jest.spyOn(repository, 'getAdapter').mockReturnValue(mockAdapter);
  });

  afterEach(() => {
    repository?.release();
    jest.clearAllMocks();
  });

  describe('list', () => {
    test('should call aggregate with the correct pipeline', async () => {
      const mockOrders: MigrationConsolidationOrder[] = [
        { id: '1', jobId: 1000, status: 'pending' },
        { id: '2', jobId: 2000, status: 'approved' },
      ];

      mockAdapter.aggregate.mockResolvedValue(mockOrders);

      const result = await repository.list();

      expect(mockAdapter.aggregate).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockOrders);

      // Verify the pipeline includes the correct fields
      const pipelineArg = mockAdapter.aggregate.mock.calls[0][0];
      expect(pipelineArg).toBeDefined();

      // Check that the pipeline includes id, jobId, and status fields
      const { include, pipeline } = QueryPipeline;
      const expectedPipeline = pipeline(
        include({ name: 'id' }, { name: 'jobId' }, { name: 'status' }),
      );
      expect(JSON.stringify(pipelineArg)).toEqual(JSON.stringify(expectedPipeline));
    });
  });

  describe('set', () => {
    test('should update a consolidation order with a new consolidationId', async () => {
      const updateValue: UpdateConsolidationId = {
        id: 'order-123',
        consolidationId: 'new-consolidation-id',
      };

      const originalOrder = {
        id: 'order-123',
        jobId: 1000,
        status: 'pending',
        // other properties
      };

      mockAdapter.findOne.mockResolvedValue(originalOrder);
      mockAdapter.insertOne.mockResolvedValue('new-id');
      mockAdapter.deleteOne.mockResolvedValue(1);

      const result = await repository.set(updateValue);

      // Check that findOne was called with the correct query
      expect(mockAdapter.findOne).toHaveBeenCalledTimes(1);

      // Check that insertOne was called with the correct data
      expect(mockAdapter.insertOne).toHaveBeenCalledTimes(1);
      expect(mockAdapter.insertOne).toHaveBeenCalledWith({
        ...originalOrder,
        id: '0-0-0-0-0', // From our mocked randomUUID
        consolidationId: 'new-consolidation-id',
      });

      // Check that deleteOne was called with the correct query
      expect(mockAdapter.deleteOne).toHaveBeenCalledTimes(1);

      // Check that the result is the input value
      expect(result).toEqual(updateValue);
    });

    test('should throw an error if the operation fails', async () => {
      const updateValue: UpdateConsolidationId = {
        id: 'order-123',
        consolidationId: 'new-consolidation-id',
      };

      const error = new Error('Database error');
      mockAdapter.findOne.mockRejectedValue(error);

      await expect(repository.set(updateValue)).rejects.toThrow();
    });
  });
});
