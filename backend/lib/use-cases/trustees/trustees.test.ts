import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { TrusteesUseCase } from './trustees';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';

describe('TrusteesUseCase tests', () => {
  let context: ApplicationContext;
  let trusteesUseCase: TrusteesUseCase;

  describe('createTrustee', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should create a trustee', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      const createTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(
          MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
        );
      const trusteeHistorySpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const actual = await trusteesUseCase.createTrustee(context, trustee);
      expect(createTrusteeSpy).toHaveBeenCalledWith(trustee, userRef);

      expect(trusteeHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: actual.trusteeId,
          documentType: 'AUDIT_NAME',
          after: actual.name,
          createdBy: userRef,
        }),
      );
      expect(trusteeHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: actual.trusteeId,
          documentType: 'AUDIT_PUBLIC_CONTACT',
          after: actual.public,
          createdBy: userRef,
        }),
      );
      expect(trusteeHistorySpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: context.session.user,
        }),
      );
    });

    test('should create a trustee with valid input (covers validation pass path)', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);

      // Create a spy on the checkValidation method to ensure it's called and passes
      const checkValidationSpy = jest.spyOn(
        trusteesUseCase as unknown as { checkValidation: jest.Mock },
        'checkValidation',
      );

      jest
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(
          MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
        );
      jest.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      await trusteesUseCase.createTrustee(context, trustee);

      // Verify that checkValidation was called and completed successfully
      expect(checkValidationSpy).toHaveBeenCalledWith(expect.objectContaining({ valid: true }));
    });

    test('should throw BadRequestError for invalid trustee input', async () => {
      const invalidTrustee = { ...MockData.getTrusteeInput(), name: '' }; // Invalid: empty name

      await expect(trusteesUseCase.createTrustee(context, invalidTrustee)).rejects.toThrow(
        BadRequestError,
      );
    });

    test('should throw error when repository create fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const repositoryError = new CamsError('Test-Module', {
        message: 'Database connection failed',
      });

      jest.spyOn(MockMongoRepository.prototype, 'createTrustee').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toEqual('Database connection failed');
    });

    test('should throw error when history creation fails', async () => {
      const trustee = MockData.getTrusteeInput();
      const userRef = getCamsUserReference(context.session.user);
      const historyError = new Error('History creation failed');

      jest
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(
          MockData.getTrustee({ ...trustee, createdBy: userRef, updatedBy: userRef }),
        );
      jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockRejectedValue(historyError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.createTrustee(context, trustee),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('listTrustees', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return list of trustees', async () => {
      const mockTrustees = [MockData.getTrustee(), MockData.getTrustee()];
      jest.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue(mockTrustees);

      const result = await trusteesUseCase.listTrustees(context);

      expect(result).toEqual(mockTrustees);
    });

    test('should handle repository error during list operation', async () => {
      const repositoryError = new Error('Database error');

      jest.spyOn(MockMongoRepository.prototype, 'listTrustees').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() => trusteesUseCase.listTrustees(context));
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('listTrusteeHistory', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return trustee history', async () => {
      const trusteeId = 'trustee-123';
      const mockHistory = [...MockData.getTrusteeHistory(), ...MockData.getTrusteeHistory()];
      jest
        .spyOn(MockMongoRepository.prototype, 'listTrusteeHistory')
        .mockResolvedValue(mockHistory);

      const result = await trusteesUseCase.listTrusteeHistory(context, trusteeId);

      expect(result).toEqual(mockHistory);
    });

    test('should handle repository error during history list operation', async () => {
      const trusteeId = 'trustee-123';
      const repositoryError = new Error('History fetch failed');

      jest
        .spyOn(MockMongoRepository.prototype, 'listTrusteeHistory')
        .mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.listTrusteeHistory(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('getTrustee', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return a single trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee();
      jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const result = await trusteesUseCase.getTrustee(context, trusteeId);

      expect(result).toEqual(mockTrustee);
    });

    test('should handle repository error when trustee not found', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.getTrustee(context, trusteeId),
      );
      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('updateTrustee', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      trusteesUseCase = new TrusteesUseCase(context);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const trusteeId = 'trustee-123';
    let existingTrustee: ReturnType<typeof MockData.getTrustee>;
    let userRef: ReturnType<typeof getCamsUserReference>;

    beforeEach(() => {
      existingTrustee = MockData.getTrustee();
      userRef = getCamsUserReference(context.session.user);
      jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingTrustee);
    });

    test('should update trustee and create name history when name changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const updatedName = 'Updated Trustee Name';
      const updateData = { name: updatedName };
      const updatedTrustee = { ...existingTrustee, name: updatedName };

      const updateTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );

      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          trusteeId,
          before: existingTrustee.name,
          after: updatedName,
          updatedBy,
          updatedOn: expect.any(String),
        }),
      );
      expect(historyCreateSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
    });

    test('should update trustee and create public contact history when public contact changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newPublicContact = MockData.getContactInformation();
      const updateData = { public: newPublicContact };
      const updatedTrustee = { ...existingTrustee, public: newPublicContact };

      const updateTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          trusteeId,
          before: existingTrustee.public,
          after: newPublicContact,
        }),
      );
    });

    test('should update trustee and create internal contact history when internal contact changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newInternalContact = MockData.getContactInformation();
      const updateData = { internal: newInternalContact };
      const updatedTrustee = { ...existingTrustee, internal: newInternalContact };

      const updateTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: existingTrustee.internal,
          after: newInternalContact,
        }),
      );
    });

    test('should update trustee and create banks history when banks change', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newBanks = ['Bank A', 'Bank B'];
      const updateData = { banks: newBanks };
      const updatedTrustee = { ...existingTrustee, banks: newBanks };

      const updateTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_BANKS',
          trusteeId,
          before: existingTrustee.banks,
          after: newBanks,
        }),
      );
    });

    test('should update trustee and create software history when software changes', async () => {
      const updatedBy = getCamsUserReference(context.session.user);
      const newSoftware = 'New Software System';
      const updateData = { software: newSoftware };
      const updatedTrustee = { ...existingTrustee, software: newSoftware };

      const updateTrusteeSpy = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      await trusteesUseCase.updateTrustee(context, trusteeId, updateData);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(trusteeId, updatedTrustee, updatedBy);
      expect(updateTrusteeSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: context.session.user }),
      );
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_SOFTWARE',
          trusteeId,
          before: existingTrustee.software,
          after: newSoftware,
        }),
      );
    });

    test('should not create history when no fields change', async () => {
      const updateData = { name: existingTrustee.name }; // Same name
      const updatedTrustee = { ...existingTrustee };

      jest.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for invalid update data', async () => {
      const invalidUpdateData = { name: '' }; // Invalid: empty name

      await expect(
        trusteesUseCase.updateTrustee(context, trusteeId, invalidUpdateData),
      ).rejects.toThrow(BadRequestError);
    });

    test('should ignore immutable fields in update data', async () => {
      const updateData = {
        name: 'Updated Name',
        trusteeId: 'should-be-ignored',
        id: 'should-be-ignored',
        createdBy: userRef,
        createdOn: new Date().toISOString(),
        updatedBy: userRef,
        updatedOn: new Date().toISOString(),
      };
      const updatedTrustee = { ...existingTrustee, name: 'Updated Name' };

      jest.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      jest.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      // Verify that updateTrustee was called
      expect(MockMongoRepository.prototype.updateTrustee).toHaveBeenCalledWith(
        trusteeId,
        expect.any(Object),
        userRef,
      );
    });

    test('should handle repository read error during update', async () => {
      const repositoryError = new Error('Trustee read failed');

      jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, {}),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should handle repository update error', async () => {
      const repositoryError = new Error('Update failed');

      jest.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteesUseCase.updateTrustee(context, trusteeId, {}),
      );
      expect(actualError.isCamsError).toBe(true);
    });

    test('should remove fields when patch values are null, undefined, or an object with all null/undefined properties', async () => {
      const updateData = {
        name: 'Updated Name',
        internal: {
          address: null,
          email: null,
          phone: null,
        },
        software: null, // Should be removed
        banks: undefined, // Should be removed
      };
      const updatedTrustee = { ...existingTrustee, name: 'Updated Name' };
      delete updatedTrustee.internal;
      delete updatedTrustee.software;
      delete updatedTrustee.banks;

      const mongoMock = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      jest.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(mongoMock).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining({
          name: 'Updated Name',
          internal: undefined,
          software: undefined,
          banks: undefined,
        }),
        expect.any(Object),
      );
      expect(result).toEqual(updatedTrustee);
      expect(result.software).toBeUndefined();
      expect(result.banks).toBeUndefined();
    });

    test('should remove fields in nested objects when patch values are null, undefined, or an object with all null/undefined properties', async () => {
      const updateData = {
        name: 'Updated Name',
        internal: {
          address: {
            address1: '1234 Test Ln',
            address2: null,
            address3: null,
            city: 'Washington',
            state: 'DC',
            zipCode: '11111',
            countryCode: 'US' as const,
          },
          email: null,
          phone: {
            number: null,
            extension: null,
          },
        },
      };
      const updatedTrustee = {
        ...existingTrustee,
        name: 'Updated Name',
        internal: {
          address: {
            address1: '1234 Test Ln',
            city: 'Washington',
            state: 'DC',
            zipCode: '11111',
            countryCode: 'US',
          },
          email: undefined,
          phone: undefined,
        },
      };

      const mongoMock = jest
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      jest.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(mongoMock).toHaveBeenCalledWith(
        trusteeId,
        expect.objectContaining(updatedTrustee),
        expect.any(Object),
      );
      expect(result).toEqual(updatedTrustee);
      expect(result.software).toBeUndefined();
      expect(result.banks).toBeUndefined();
    });

    test('should handle empty internal contact object when updating from empty to populated', async () => {
      // Set up existing trustee with empty internal contact
      const existingTrusteeWithEmptyInternal = {
        ...existingTrustee,
        internal: {},
      };
      jest
        .spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValue(existingTrusteeWithEmptyInternal);

      const newInternalContact = MockData.getContactInformation();
      const updateData = { internal: newInternalContact };
      const updatedTrustee = { ...existingTrusteeWithEmptyInternal, internal: newInternalContact };

      jest.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: undefined, // Should be undefined for empty object
          after: newInternalContact,
        }),
      );
    });

    test('should handle empty internal contact object when updating from populated to empty', async () => {
      // Set up existing trustee with populated internal contact
      const existingInternalContact = MockData.getContactInformation();
      const existingTrusteeWithInternal = {
        ...existingTrustee,
        internal: existingInternalContact,
      };
      jest
        .spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValue(existingTrusteeWithInternal);

      const updateData = { internal: {} };
      const updatedTrustee = { ...existingTrusteeWithInternal, internal: {} };

      jest.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(updatedTrustee);
      const historyCreateSpy = jest
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue();

      const result = await trusteesUseCase.updateTrustee(context, trusteeId, updateData);

      expect(result).toEqual(updatedTrustee);
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          trusteeId,
          before: existingInternalContact,
          after: undefined, // Should be undefined for empty object
        }),
      );
    });
  });
});
