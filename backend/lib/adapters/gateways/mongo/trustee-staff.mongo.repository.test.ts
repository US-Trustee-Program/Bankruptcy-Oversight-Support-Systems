import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeStaffMongoRepository } from './trustee-staff.mongo.repository';
import { TrusteeStaff } from '@common/cams/trustee-staff';
import { CamsUserReference } from '@common/cams/users';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import MockData from '@common/cams/test-utilities/mock-data';

describe('TrusteeStaffMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeStaffMongoRepository;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleStaffMember: TrusteeStaff = MockData.getTrusteeStaff({
    id: 'staff-1',
    trusteeId: 'trustee-1',
    name: 'Jane Doe',
    title: 'Legal Staff',
    createdBy: mockUser,
    updatedBy: mockUser,
  });

  // Helper to create expected query for filtering by documentType + additional fields
  const createQuery = (additionalFilters: Array<{ field: string; value: string }>) => ({
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_STAFF',
      },
      ...additionalFilters.map((filter) => ({
        condition: 'EQUALS',
        leftOperand: { name: filter.field },
        rightOperand: filter.value,
      })),
    ],
  });

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repository = new TrusteeStaffMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteeStaffMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should return the same instance on multiple calls', async () => {
      const instance1 = TrusteeStaffMongoRepository.getInstance(context);
      const instance2 = TrusteeStaffMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);

      instance1.release();
      instance2.release();
    });

    test('should manage reference count correctly', async () => {
      const instance1 = TrusteeStaffMongoRepository.getInstance(context);
      const instance2 = TrusteeStaffMongoRepository.getInstance(context);
      const instance3 = TrusteeStaffMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      instance1.release();
      instance2.release();

      const instance4 = TrusteeStaffMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      instance3.release();
      instance4.release();
    });
  });

  describe('readStaffMember', () => {
    test('should retrieve trustee staff member by ID and trusteeId', async () => {
      const expectedQuery = createQuery([
        { field: 'id', value: 'staff-1' },
        { field: 'trusteeId', value: 'trustee-1' },
      ]);
      const mockFindOne = vi.fn().mockResolvedValue(sampleStaffMember);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      const result = await repository.readStaffMember('trustee-1', 'staff-1');

      expect(result).toEqual(sampleStaffMember);
      expect(mockFindOne).toHaveBeenCalledWith(expectedQuery);
    });

    test('should throw NotFoundError when staff member does not exist', async () => {
      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.readStaffMember('trustee-1', 'non-existent')).rejects.toThrow(
        'Trustee staff member with ID non-existent not found',
      );
    });

    test('should throw NotFoundError when staff member does not belong to trustee', async () => {
      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.readStaffMember('wrong-trustee', 'staff-1')).rejects.toThrow(
        'Trustee staff member with ID staff-1 not found',
      );
    });

    test('should wrap database errors with context', async () => {
      const mockFindOne = vi.fn().mockRejectedValue(new Error('Database connection error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.readStaffMember('trustee-1', 'staff-1')).rejects.toThrow(
        'Failed to retrieve trustee staff member with ID staff-1',
      );
    });
  });

  describe('getTrusteeStaff', () => {
    test('should retrieve all staff for a trustee', async () => {
      const expectedQuery = createQuery([{ field: 'trusteeId', value: 'trustee-1' }]);
      const staffMember1 = MockData.getTrusteeStaff({
        id: 'staff-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
      });
      const staffMember2 = MockData.getTrusteeStaff({
        id: 'staff-2',
        trusteeId: 'trustee-1',
        name: 'John Smith',
      });

      const mockFind = vi.fn().mockResolvedValue([staffMember1, staffMember2]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      const result = await repository.getTrusteeStaff('trustee-1');

      expect(result).toEqual([staffMember1, staffMember2]);
      expect(mockFind).toHaveBeenCalledWith(expectedQuery);
    });

    test('should return empty array when trustee has no staff', async () => {
      const expectedQuery = createQuery([{ field: 'trusteeId', value: 'trustee-1' }]);
      const mockFind = vi.fn().mockResolvedValue([]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      const result = await repository.getTrusteeStaff('trustee-1');

      expect(result).toEqual([]);
      expect(mockFind).toHaveBeenCalledWith(expectedQuery);
    });

    test('should handle database errors gracefully', async () => {
      const mockFind = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      await expect(repository.getTrusteeStaff('trustee-1')).rejects.toThrow(
        'Failed to retrieve staff for trustee trustee-1',
      );
    });
  });

  describe('createStaffMember', () => {
    test('should create a new staff member', async () => {
      const staffInput = {
        name: 'Jane Doe',
        title: 'Legal Staff',
        contact: MockData.getContactInformation(),
      };

      const mockInsertOne = vi.fn().mockResolvedValue('new-staff-id');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);

      const result = await repository.createStaffMember('trustee-1', staffInput, mockUser);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'new-staff-id',
          trusteeId: 'trustee-1',
          name: 'Jane Doe',
          title: 'Legal Staff',
        }),
      );
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: 'trustee-1',
          documentType: 'TRUSTEE_STAFF',
          name: 'Jane Doe',
          title: 'Legal Staff',
          createdBy: mockUser,
        }),
      );
    });

    test('should wrap database errors with context', async () => {
      const staffInput = {
        name: 'Jane Doe',
      };

      const mockInsertOne = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);

      await expect(repository.createStaffMember('trustee-1', staffInput, mockUser)).rejects.toThrow(
        'Failed to create trustee staff member for trustee trustee-1',
      );
    });
  });

  describe('updateStaffMember', () => {
    test('should update an existing staff member', async () => {
      const existingStaffMember = MockData.getTrusteeStaff({
        id: 'staff-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
        title: 'Legal Staff',
      });

      const updateInput = {
        name: 'Jane Smith',
        title: 'Senior Legal Staff',
      };

      const mockFindOne = vi.fn().mockResolvedValue(existingStaffMember);
      const mockReplaceOne = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);

      const result = await repository.updateStaffMember(
        'trustee-1',
        'staff-1',
        updateInput,
        mockUser,
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'staff-1',
          trusteeId: 'trustee-1',
          name: 'Jane Smith',
          title: 'Senior Legal Staff',
          updatedBy: mockUser,
        }),
      );
      expect(mockReplaceOne).toHaveBeenCalled();
    });

    test('should throw NotFoundError when staff member does not exist', async () => {
      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(
        repository.updateStaffMember('trustee-1', 'non-existent', updateInput, mockUser),
      ).rejects.toThrow('Trustee staff member with ID non-existent not found');
    });

    test('should throw NotFoundError when staff member does not belong to trustee', async () => {
      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(
        repository.updateStaffMember('trustee-1', 'staff-1', updateInput, mockUser),
      ).rejects.toThrow('Trustee staff member with ID staff-1 not found');
    });

    test('should wrap database errors with context', async () => {
      const existingStaffMember = MockData.getTrusteeStaff({
        id: 'staff-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
      });

      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(existingStaffMember);
      const mockReplaceOne = vi.fn().mockRejectedValue(new Error('Database error'));

      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);

      await expect(
        repository.updateStaffMember('trustee-1', 'staff-1', updateInput, mockUser),
      ).rejects.toThrow('Failed to update trustee staff member staff-1');
    });
  });

  describe('deleteStaffMember', () => {
    test('should delete a staff member by ID and trusteeId', async () => {
      const expectedQuery = createQuery([
        { field: 'id', value: 'staff-1' },
        { field: 'trusteeId', value: 'trustee-1' },
      ]);
      const mockDeleteOne = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await repository.deleteStaffMember('trustee-1', 'staff-1');

      expect(mockDeleteOne).toHaveBeenCalledWith(expectedQuery);
    });

    test('should throw NotFoundError when staff member does not belong to trustee', async () => {
      const mockDeleteOne = vi.fn().mockRejectedValue(new Error('No document found'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await expect(repository.deleteStaffMember('wrong-trustee', 'staff-1')).rejects.toThrow(
        'Failed to delete trustee staff member staff-1',
      );
    });

    test('should wrap database errors with context', async () => {
      const mockDeleteOne = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await expect(repository.deleteStaffMember('trustee-1', 'staff-1')).rejects.toThrow(
        'Failed to delete trustee staff member staff-1',
      );
    });
  });
});
