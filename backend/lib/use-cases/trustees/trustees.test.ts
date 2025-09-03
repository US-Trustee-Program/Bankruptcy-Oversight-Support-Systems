// Mock the validation - need to import actual then mock specific functions
jest.mock('../../../../common/src/cams/parties', () => {
  const actualParties = jest.requireActual('../../../../common/src/cams/parties');
  return {
    ...actualParties,
    validateTrusteeCreationInput: jest.fn(),
  };
});

// Mock the factory module
jest.mock('../../factory');

// Mock the error utilities
jest.mock('../../common-errors/error-utilities');

// Mock the session utilities
jest.mock('../../../../common/src/cams/session');

import { TrusteesUseCase } from './trustees';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeInput } from '../../../../common/src/cams/parties';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { getTrusteesRepository } from '../../factory';
import { getCamsUserReference } from '../../../../common/src/cams/session';

const mockGetTrusteesRepository = getTrusteesRepository as jest.MockedFunction<
  typeof getTrusteesRepository
>;

const mockGetCamsError = getCamsError as jest.MockedFunction<typeof getCamsError>;

const mockGetCamsUserReference = getCamsUserReference as jest.MockedFunction<
  typeof getCamsUserReference
>;

describe('TrusteesUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteesUseCase;
  let mockTrusteesRepository: jest.Mocked<TrusteesRepository>;

  const mockUserReference: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleTrusteeInput: TrusteeInput = {
    name: 'John Doe',
    address: {
      address1: '123 Main St',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    },
    phone: '333-555-0123',
    email: 'john.doe@example.com',
    districts: ['NY'],
    chapters: ['7', '11'],
    status: 'active',
  };

  const sampleTrustee = {
    ...sampleTrusteeInput,
    id: 'trustee-123',
    createdOn: '2025-08-12T10:00:00Z',
    createdBy: mockUserReference,
    updatedOn: '2025-08-12T10:00:00Z',
    updatedBy: mockUserReference,
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockTrusteesRepository = {
      createTrustee: jest.fn(),
      listTrustees: jest.fn(),
      read: jest.fn(),
      release: jest.fn(),
    } as jest.Mocked<TrusteesRepository>;

    mockGetTrusteesRepository.mockReturnValue(mockTrusteesRepository);
    mockGetCamsUserReference.mockReturnValue(mockUserReference);

    // Set up getCamsError to return a proper CamsError
    mockGetCamsError.mockImplementation((originalError) => {
      const message =
        originalError instanceof Error ? originalError.message : String(originalError);
      return new CamsError('TRUSTEES-USE-CASE', { message });
    });

    useCase = new TrusteesUseCase(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
  });

  describe('createTrustee', () => {
    test('should create trustee successfully with valid input', async () => {
      const expectedTrustee = {
        id: 'trustee-123',
        ...sampleTrusteeInput,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, sampleTrusteeInput);

      expect(mockGetCamsUserReference).toHaveBeenCalledWith(context.session.user);
      expect(mockTrusteesRepository.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          ...sampleTrusteeInput,
          status: 'active',
          districts: ['NY'],
          chapters: ['7', '11'],
        }),
        mockUserReference,
      );
      expect(result).toEqual(expectedTrustee);
    });

    test('should throw error when validation fails', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: '',
        address: {
          address1: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '123456',
          countryCode: 'US',
        },
        phone: '123', // Invalid phone number - too short
        email: 'invalid-email',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: This field is required, Provided email does not match regular expression, Provided phone number does not match regular expression, ZIP code must be valid (5 digits or 5+4 format)',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should handle repository errors and convert them to CAMS errors', async () => {
      const repositoryError = new Error('Database connection failed');
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: 'Database connection failed',
      });

      mockTrusteesRepository.createTrustee.mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.createTrustee(context, sampleTrusteeInput)).rejects.toThrow(
        expectedCamsError,
      );

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });

    test('should validate address object - missing address1', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: 'John Doe',
        address: {
          address1: '', // Empty address1 should fail
          city: 'Anytown',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
        phone: '3335550123', // Valid phone format (digits only)
        email: 'john.doe@example.com',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: Address line 1 is required',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should validate address object - missing city', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: 'John Doe',
        address: {
          address1: '123 Main St',
          city: '', // Empty city should fail
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
        phone: '(333) 555-0123', // Valid phone format (with parentheses)
        email: 'john.doe@example.com',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: City is required',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should validate address object - invalid state', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: 'John Doe',
        address: {
          address1: '123 Main St',
          city: 'Anytown',
          state: 'NEW YORK', // Invalid state format - should be 2 chars
          zipCode: '12345',
          countryCode: 'US',
        },
        phone: '333.555.0123', // Valid phone format (with dots)
        email: 'john.doe@example.com',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: State must be a 2-character code',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should validate address object - invalid zipCode', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: 'John Doe',
        address: {
          address1: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '1234', // Invalid ZIP format
          countryCode: 'US',
        },
        phone: '333 555 0123', // Valid phone format (with spaces)
        email: 'john.doe@example.com',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: ZIP code must be valid (5 digits or 5+4 format)',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should validate address object - invalid address type', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: 'John Doe',
        address: 'invalid address' as unknown as TrusteeInput['address'], // Address should be object, not string
        phone: '333 555 0123', // Valid phone format (with spaces)
        email: 'john.doe@example.com',
        status: 'active',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: Address must be a valid object if provided',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });
  });

  describe('listTrustees', () => {
    test('should successfully retrieve a list of trustees', async () => {
      const mockTrustees = [sampleTrustee];
      mockTrusteesRepository.listTrustees.mockResolvedValue(mockTrustees);

      const result = await useCase.listTrustees(context);

      expect(mockTrusteesRepository.listTrustees).toHaveBeenCalled();
      expect(result).toEqual(mockTrustees);
    });

    test('should handle repository errors when listing trustees', async () => {
      const repositoryError = new Error('Database connection failed');
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: 'Database connection failed',
      });

      mockTrusteesRepository.listTrustees.mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.listTrustees(context)).rejects.toThrow(expectedCamsError);

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });
  });

  describe('getTrustee', () => {
    test('should successfully retrieve a trustee by ID', async () => {
      const trusteeId = 'trustee-123';
      mockTrusteesRepository.read.mockResolvedValue(sampleTrustee);

      const result = await useCase.getTrustee(context, trusteeId);

      expect(mockTrusteesRepository.read).toHaveBeenCalledWith(trusteeId);
      expect(result).toEqual(sampleTrustee);
    });

    test('should handle repository errors when getting a trustee', async () => {
      const trusteeId = 'nonexistent-id';
      const repositoryError = new Error('Trustee with ID nonexistent-id not found.');
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: 'Trustee with ID nonexistent-id not found.',
      });

      mockTrusteesRepository.read.mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.getTrustee(context, trusteeId)).rejects.toThrow(expectedCamsError);

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });
  });
});
