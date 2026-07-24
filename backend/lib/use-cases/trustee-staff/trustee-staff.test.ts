import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeStaffUseCase } from './trustee-staff';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeStaffInput } from '@common/cams/trustee-staff';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { UnknownError } from '../../common-errors/unknown-error';
import { getCamsUserReference } from '@common/cams/session';

const MODULE_NAME = 'TRUSTEE-STAFF-USE-CASE';

describe('TrusteeStaffUseCase', () => {
  let context: ApplicationContext;
  let trusteeStaffUseCase: TrusteeStaffUseCase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    trusteeStaffUseCase = new TrusteeStaffUseCase(context);
  });

  describe('getTrusteeStaff', () => {
    test('should return list of staff for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockStaff = [
        MockData.getTrusteeStaff({ trusteeId }),
        MockData.getTrusteeStaff({ trusteeId }),
      ];

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeStaff').mockResolvedValue(mockStaff);

      const result = await trusteeStaffUseCase.getTrusteeStaff(context, trusteeId);

      expect(result).toEqual(mockStaff);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
      expect(MockMongoRepository.prototype.getTrusteeStaff).toHaveBeenCalledWith(trusteeId);
    });

    test('should return empty array when trustee has no staff', async () => {
      const trusteeId = 'trustee-456';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeStaff').mockResolvedValue([]);

      const result = await trusteeStaffUseCase.getTrusteeStaff(context, trusteeId);

      expect(result).toEqual([]);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
    });

    test('should throw error when trustee does not exist', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.getTrusteeStaff(context, trusteeId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should handle repository error during staff retrieval', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeStaff').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.getTrusteeStaff(context, trusteeId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('createStaffMember', () => {
    const trusteeId = 'trustee-123';
    const mockTrustee = {
      id: trusteeId,
      name: 'John Doe',
      trusteeId: '123',
      public: {},
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T00:00:00Z',
    };

    const validInput: TrusteeStaffInput = {
      name: 'Jane Staff',
      title: 'Senior Legal Staff',
      contact: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phones: [
          {
            number: '555-123-4567',
            type: 'direct',
          },
        ],
        email: 'jane@example.com',
      },
    };

    const createdStaffMember = {
      id: 'staff-123',
      trusteeId,
      ...validInput,
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T00:00:00Z',
    };

    test('should create a staff member with valid input', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createStaffMember').mockResolvedValue(
        createdStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeStaffUseCase.createStaffMember(context, trusteeId, validInput);

      expect(result).toEqual(createdStaffMember);
      expect(MockMongoRepository.prototype.createStaffMember).toHaveBeenCalledWith(
        trusteeId,
        validInput,
        getCamsUserReference(context.session.user),
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      await expect(
        trusteeStaffUseCase.createStaffMember(context, trusteeId, validInput),
      ).rejects.toThrow();
    });

    test('should throw error when name is missing', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const invalidInput = { ...validInput, name: '' };

      await expect(
        trusteeStaffUseCase.createStaffMember(context, trusteeId, invalidInput),
      ).rejects.toThrow();
    });

    test('should create audit history record after creating staff member', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createStaffMember').mockResolvedValue(
        createdStaffMember,
      );
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeStaffUseCase.createStaffMember(context, trusteeId, validInput);

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_STAFF',
          staffId: createdStaffMember.id,
          before: undefined,
          after: createdStaffMember,
        }),
      );
    });

    test('should track a Phone Number Added event for each phone on the new staff member', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createStaffMember').mockResolvedValue(
        createdStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);
      const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

      await trusteeStaffUseCase.createStaffMember(context, trusteeId, validInput);

      const phoneAddedCalls = completeTraceSpy.mock.calls.filter(
        (call) => call[1] === 'Phone Number Added',
      );
      expect(phoneAddedCalls).toHaveLength(validInput.contact!.phones!.length);
      phoneAddedCalls.forEach((call) => {
        expect(call[2]).toEqual(
          expect.objectContaining({ success: true, properties: { contactType: 'staff' } }),
        );
      });
    });
  });

  describe('getStaffMember', () => {
    const trusteeId = 'trustee-123';
    const staffId = 'staff-123';
    const mockStaffMember = MockData.getTrusteeStaff({
      id: staffId,
      trusteeId,
    });

    test('should return staff member by ID', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(mockStaffMember);

      const result = await trusteeStaffUseCase.getStaffMember(context, trusteeId, staffId);

      expect(result).toEqual(mockStaffMember);
      expect(MockMongoRepository.prototype.readStaffMember).toHaveBeenCalledWith(
        trusteeId,
        staffId,
      );
    });

    test('should wrap a repository error as a CAMS error', async () => {
      const repositoryError = new Error('Staff member not found');
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.getStaffMember(context, trusteeId, staffId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('updateStaffMember', () => {
    const trusteeId = 'trustee-123';
    const staffId = 'staff-456';
    const existingStaffMember = MockData.getTrusteeStaff({
      id: staffId,
      trusteeId,
      name: 'Jane Staff',
      title: 'Legal Staff',
    });

    const updateInput: TrusteeStaffInput = {
      name: 'Jane Updated Staff',
      title: 'Senior Legal Staff',
      contact: {
        address: {
          address1: '456 Oak St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
        phones: [
          {
            number: '555-987-6543',
            type: 'direct',
          },
        ],
        email: 'jane.updated@example.com',
      },
    };

    const updatedStaffMember = {
      ...existingStaffMember,
      ...updateInput,
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-02T00:00:00Z',
    };

    test('should update a staff member with valid input', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        existingStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateStaffMember').mockResolvedValue(
        updatedStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeStaffUseCase.updateStaffMember(
        context,
        trusteeId,
        staffId,
        updateInput,
      );

      expect(result).toEqual(updatedStaffMember);
      expect(MockMongoRepository.prototype.updateStaffMember).toHaveBeenCalledWith(
        trusteeId,
        staffId,
        updateInput,
        getCamsUserReference(context.session.user),
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      await expect(
        trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, updateInput),
      ).rejects.toThrow();
    });

    test('should throw error when staff member does not exist', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockRejectedValue(
        new Error('Staff member not found'),
      );

      await expect(
        trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, updateInput),
      ).rejects.toThrow();
    });

    test('should throw error when name is missing', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const invalidInput = { ...updateInput, name: '' };

      await expect(
        trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, invalidInput),
      ).rejects.toThrow();
    });

    test('should create audit history record after updating staff member', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        existingStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateStaffMember').mockResolvedValue(
        updatedStaffMember,
      );
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, updateInput);

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_STAFF',
          staffId: staffId,
          before: existingStaffMember,
          after: updatedStaffMember,
        }),
      );
    });

    test('should track a Phone Number Added event for each phone added to the staff member', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      const staffWithOnePhone = MockData.getTrusteeStaff({
        id: staffId,
        trusteeId,
        contact: { phones: [{ type: 'direct', number: '555-000-0001' }] },
      });
      const staffWithThreePhones = {
        ...staffWithOnePhone,
        contact: {
          ...staffWithOnePhone.contact,
          phones: [
            { type: 'direct' as const, number: '555-000-0001' },
            { type: 'home' as const, number: '555-000-0002' },
            { type: 'fax' as const, number: '555-000-0003' },
          ],
        },
      };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        staffWithOnePhone,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateStaffMember').mockResolvedValue(
        staffWithThreePhones,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);
      const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

      await trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, updateInput);

      const phoneAddedCalls = completeTraceSpy.mock.calls.filter(
        (call) => call[1] === 'Phone Number Added',
      );
      expect(phoneAddedCalls).toHaveLength(2);
      phoneAddedCalls.forEach((call) => {
        expect(call[2]).toEqual(
          expect.objectContaining({ success: true, properties: { contactType: 'staff' } }),
        );
      });
    });

    test('should not track a Phone Number Added event when phones are removed', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      const staffWithTwoPhones = MockData.getTrusteeStaff({
        id: staffId,
        trusteeId,
        contact: {
          phones: [
            { type: 'direct' as const, number: '555-000-0001' },
            { type: 'home' as const, number: '555-000-0002' },
          ],
        },
      });
      const staffWithOnePhone = {
        ...staffWithTwoPhones,
        contact: {
          ...staffWithTwoPhones.contact,
          phones: [{ type: 'direct' as const, number: '555-000-0001' }],
        },
      };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        staffWithTwoPhones,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateStaffMember').mockResolvedValue(
        staffWithOnePhone,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);
      const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');

      await trusteeStaffUseCase.updateStaffMember(context, trusteeId, staffId, updateInput);

      const phoneAddedCalls = completeTraceSpy.mock.calls.filter(
        (call) => call[1] === 'Phone Number Added',
      );
      expect(phoneAddedCalls).toHaveLength(0);
    });
  });

  describe('deleteStaffMember', () => {
    const trusteeId = 'trustee-123';
    const staffId = 'staff-456';
    const existingStaffMember = MockData.getTrusteeStaff({
      id: staffId,
      trusteeId,
      name: 'Jane Staff',
    });

    test('should delete a staff member and create audit history', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        existingStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'deleteStaffMember').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeStaffUseCase.deleteStaffMember(context, trusteeId, staffId);

      expect(MockMongoRepository.prototype.deleteStaffMember).toHaveBeenCalledWith(
        trusteeId,
        staffId,
      );
      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_STAFF',
          staffId,
          before: existingStaffMember,
          after: undefined,
        }),
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.deleteStaffMember(context, trusteeId, staffId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw error when staff member does not exist', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockRejectedValue(
        new Error('Staff member not found'),
      );

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.deleteStaffMember(context, trusteeId, staffId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw error when repository delete fails', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        existingStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'deleteStaffMember').mockRejectedValue(
        new Error('Database error'),
      );

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.deleteStaffMember(context, trusteeId, staffId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw error when history creation fails during delete', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'readStaffMember').mockResolvedValue(
        existingStaffMember,
      );
      vi.spyOn(MockMongoRepository.prototype, 'deleteStaffMember').mockResolvedValue(undefined);
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockRejectedValue(
        new Error('History creation failed'),
      );

      const actualError = await getTheThrownError(() =>
        trusteeStaffUseCase.deleteStaffMember(context, trusteeId, staffId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });
});
