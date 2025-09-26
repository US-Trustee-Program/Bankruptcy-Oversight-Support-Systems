// Mock the validation - need to import actual then mock specific functions
import { ContactInformation } from '../../../../common/src/cams/contact';

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

// Mock the deepEqual function
jest.mock('../../../../common/src/object-equality', () => ({
  deepEqual: jest.fn().mockImplementation((a, b) => {
    // Return true if both are undefined or null (considered equal)
    if (a == null && b == null) {
      return true;
    }
    // Return false otherwise to trigger history creation in tests
    return false;
  }),
}));

import { TrusteesUseCase } from './trustees';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeInput, ChapterType } from '../../../../common/src/cams/trustees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { getTrusteesRepository } from '../../factory';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import * as validationModule from '../../../../common/src/cams/validation';
import { deepEqual } from '../../../../common/src/object-equality';

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
    public: {
      address: {
        address1: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US' as const,
      },
      phone: {
        number: '333-555-0123',
      },
      email: 'john.doe@example.com',
      website: 'https://www.johndoe-ch13-trustee.com',
    },
    internal: {
      address: {
        address1: '456 Internal St',
        city: 'Internal City',
        state: 'CA',
        zipCode: '54321',
        countryCode: 'US' as const,
      },
      phone: {
        number: '333-555-9876',
        extension: '123',
      },
      email: 'john.doe.internal@example.com',
      website: 'https://internal.johndoe-ch13-trustee.com',
    },
    districts: ['NY'],
    chapters: ['13'],
    status: 'active' as const,
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
      createTrusteeHistory: jest.fn(),
      listTrustees: jest.fn(),
      listTrusteeHistory: jest.fn(),
      updateTrustee: jest.fn(),
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
          status: 'active' as const,
          districts: ['NY'],
          chapters: ['13'],
        }),
        mockUserReference,
      );

      // Verify createHistory is called for the name audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          id: expectedTrustee.id,
          before: undefined,
          after: expectedTrustee.name,
          createdBy: mockUserReference,
        }),
      );

      // Verify createHistory is called for the public contact audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: expectedTrustee.id,
          before: undefined,
          after: expectedTrustee.public,
          createdBy: mockUserReference,
        }),
      );

      expect(result).toEqual(expectedTrustee);
    });

    test('should throw error when validation fails', async () => {
      const invalidTrusteeInput: TrusteeInput = {
        name: '',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '123456', // Invalid zip code
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-0123', // Invalid phone format
          },
          email: 'invalid-email', // Invalid email
        },
        status: 'active' as const,
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: $.name: Must contain at least 1 characters. $.public.address.zipCode: Must be valid zip code. $.public.phone.number: Provided phone number does not match regular expression. $.public.email: Provided email does not match regular expression.',
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

    test('should handle trustee input with undefined districts and chapters', async () => {
      const trusteeInputWithoutArrays: TrusteeInput = {
        name: 'John Doe',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US' as const,
          },
          phone: {
            number: '333-555-0123',
          },
          email: 'john.doe@example.com',
        },
        status: 'active' as const,
      };

      const expectedTrustee = {
        ...trusteeInputWithoutArrays,
        id: 'trustee-123',
        districts: [],
        chapters: [],
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, trusteeInputWithoutArrays);

      expect(mockTrusteesRepository.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          ...trusteeInputWithoutArrays,
          districts: [], // Should default to empty array
          chapters: [], // Should default to empty array
        }),
        mockUserReference,
      );
      expect(result).toEqual(expectedTrustee);
    });

    test('should handle validation error with undefined reasonMap', async () => {
      mockTrusteesRepository.createTrustee.mockRejectedValue(new Error('should not be called'));

      const mockValidationResult = { reasonMap: undefined };
      jest.spyOn(validationModule, 'validateObject').mockReturnValue(mockValidationResult);

      const invalidInput = { name: '', status: 'active' } as TrusteeInput;

      await expect(useCase.createTrustee(context, invalidInput)).rejects.toThrow(
        'Trustee validation failed: .',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    test('should create Chapter 13 trustee with website information successfully', async () => {
      const ch13TrusteeInput: TrusteeInput = {
        name: 'Jane Smith',
        public: {
          address: {
            address1: '789 Chapter 13 Ave',
            city: 'Consumer City',
            state: 'TX',
            zipCode: '77001',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0199',
            extension: '456',
          },
          email: 'jane.smith@ch13-trustee.com',
          website: 'https://www.janesmith-ch13.com',
        },
        internal: {
          address: {
            address1: '321 Internal Ave',
            city: 'Houston',
            state: 'TX',
            zipCode: '77002',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0100',
          },
          email: 'jane.smith.internal@ustp.gov',
          website: 'https://internal.janesmith-ch13.com',
        },
        districts: ['TX'],
        chapters: ['13'],
        status: 'active' as const,
      };

      const expectedTrustee = {
        id: 'trustee-456',
        ...ch13TrusteeInput,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, ch13TrusteeInput);

      expect(result).toEqual(expectedTrustee);
      expect(mockTrusteesRepository.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          ...ch13TrusteeInput,
          status: 'active' as const,
          districts: ['TX'],
          chapters: ['13'],
        }),
        mockUserReference,
      );

      // Verify website information is preserved in the created trustee
      expect(result.public.website).toBe('https://www.janesmith-ch13.com');
      expect(result.internal?.website).toBe('https://internal.janesmith-ch13.com');
    });

    test('should create trustee with public website but no internal website', async () => {
      const trusteeWithPublicWebsiteOnly: TrusteeInput = {
        name: 'Bob Johnson',
        public: {
          address: {
            address1: '456 Public Ave',
            city: 'Public City',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US' as const,
          },
          phone: {
            number: '305-555-0123',
          },
          email: 'bob.johnson@ch13-trustee.com',
          website: 'https://www.bobjohnson-ch13.com',
        },
        internal: {
          address: {
            address1: '654 Internal St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33102',
            countryCode: 'US' as const,
          },
          email: 'bob.johnson.internal@ustp.gov',
          // No website for internal
        },
        districts: ['FL'],
        chapters: ['13'],
        status: 'active' as const,
      };

      const expectedTrustee = {
        id: 'trustee-789',
        ...trusteeWithPublicWebsiteOnly,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, trusteeWithPublicWebsiteOnly);

      expect(result).toEqual(expectedTrustee);
      expect(result.public.website).toBe('https://www.bobjohnson-ch13.com');
      expect(result.internal?.website).toBeUndefined();
    });

    test('should create trustee without any website information', async () => {
      const trusteeWithoutWebsite: TrusteeInput = {
        name: 'Alice Wilson',
        public: {
          address: {
            address1: '123 No Website St',
            city: 'Traditional City',
            state: 'CA',
            zipCode: '90210',
            countryCode: 'US' as const,
          },
          phone: {
            number: '310-555-0199',
          },
          email: 'alice.wilson@traditional-trustee.com',
          // No website
        },
        districts: ['CA'],
        chapters: ['7-panel'], // Non-Chapter 13 trustee typically wouldn't have website
        status: 'active' as const,
      };

      const expectedTrustee = {
        id: 'trustee-101',
        ...trusteeWithoutWebsite,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, trusteeWithoutWebsite);

      expect(result).toEqual(expectedTrustee);
      expect(result.public.website).toBeUndefined();
      expect(result.internal?.website).toBeUndefined();
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

  describe('updateTrustee', () => {
    test('should update trustee successfully with valid input and create history records', async () => {
      const trusteeId = 'trustee-123';

      // Simplified test setup
      const existingTrustee = {
        id: trusteeId,
        name: 'John Doe',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US' as const,
          },
        },
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updatedTrustee = {
        id: trusteeId,
        name: 'Jane Doe Updated',
        public: {
          address: {
            address1: '456 Updated St',
            city: 'Newtown',
            state: 'CA',
            zipCode: '54321',
            countryCode: 'US' as const,
          },
        },
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput = {
        name: 'Jane Doe Updated',
        public: {
          address: {
            address1: '456 Updated St',
            city: 'Newtown',
            state: 'CA',
            zipCode: '54321',
            countryCode: 'US' as const,
          },
        },
        status: 'active' as const,
      };

      // Reset mock history before test to ensure clean slate
      jest.clearAllMocks();

      // Mock repository behavior
      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);
      mockTrusteesRepository.createTrusteeHistory.mockResolvedValue(undefined);

      // Execute the function
      await useCase.updateTrustee(context, trusteeId, updateInput);

      // Verify createHistory is called for the name audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          id: trusteeId,
          before: existingTrustee.name,
          after: updatedTrustee.name,
        }),
      );

      // Verify createHistory is called for the public contact audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updatedTrustee.public,
        }),
      );
    });

    test('should update trustee successfully with internal contact information and create history records', async () => {
      const trusteeId = 'trustee-123';

      // Simplified test setup with internal contact
      const existingTrustee = {
        id: trusteeId,
        name: 'John Doe',
        public: {} as ContactInformation,
        internal: undefined, // No internal contact information
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const internalContact = {
        address: {
          address1: '789 Internal St',
          city: 'Internal City',
          state: 'TX',
          zipCode: '75001',
          countryCode: 'US' as const,
        },
        phone: {
          number: '214-555-0199',
          extension: '1234',
        },
        email: 'jane.internal@trustee.gov',
      };

      const updatedTrustee = {
        id: trusteeId,
        name: 'Jane Doe With Internal',
        public: {} as ContactInformation,
        internal: internalContact,
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput = {
        name: 'Jane Doe With Internal',
        internal: internalContact,
        status: 'active' as const,
      };

      // Reset mock history before test to ensure clean slate
      jest.clearAllMocks();

      // Mock repository behavior
      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);
      mockTrusteesRepository.createTrusteeHistory.mockResolvedValue(undefined);

      // Execute the function
      await useCase.updateTrustee(context, trusteeId, updateInput);

      // Verify createHistory is called for the name audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          id: trusteeId,
          before: existingTrustee.name,
          after: updatedTrustee.name,
        }),
      );

      // Verify createHistory is called for the internal contact audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          id: trusteeId,
          before: existingTrustee.internal,
          after: updatedTrustee.internal,
        }),
      );
    });

    test('should throw error when validation fails for update', async () => {
      const trusteeId = 'trustee-123';
      const invalidTrusteeInput: TrusteeInput = {
        name: '',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '123456', // Invalid zip code
            countryCode: 'US' as const,
          },
          phone: {
            number: '555-0123', // Invalid phone format
          },
          email: 'invalid-email', // Invalid email
        },
        status: 'active' as const,
      };

      mockTrusteesRepository.updateTrustee = jest.fn();

      await expect(useCase.updateTrustee(context, trusteeId, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: $.name: Must contain at least 1 characters. $.public.address.zipCode: Must be valid zip code. $.public.phone.number: Provided phone number does not match regular expression. $.public.email: Provided email does not match regular expression.',
      );

      expect(mockTrusteesRepository.updateTrustee).not.toHaveBeenCalled();
    });

    test('should handle repository errors and convert them to CAMS errors for update', async () => {
      const trusteeId = 'trustee-123';
      const repositoryError = new Error('Database connection failed');
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: 'Database connection failed',
      });

      mockTrusteesRepository.updateTrustee = jest.fn().mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.updateTrustee(context, trusteeId, sampleTrusteeInput)).rejects.toThrow(
        expectedCamsError,
      );

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });

    test('should handle trustee update without arrays and create appropriate history records', async () => {
      const trusteeId = 'trustee-123';

      // Simplified test setup
      const existingTrustee = {
        id: trusteeId,
        name: 'John Doe Old',
        public: {
          address: {
            address1: '123 Old St',
            city: 'Oldtown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US' as const,
          },
        },
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updatedPublicInfo = {
        address: {
          address1: '789 Update Ave',
          city: 'Updatetown',
          state: 'TX',
          zipCode: '67890',
          countryCode: 'US' as const,
        },
        phone: {
          number: '333-555-4567',
        },
        email: 'john.updated@example.com',
      };

      const updatedTrustee = {
        id: trusteeId,
        name: 'John Doe Updated',
        public: updatedPublicInfo,
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput = {
        name: 'John Doe Updated',
        public: updatedPublicInfo,
        status: 'active' as const,
      };

      // Reset mock history before test to ensure clean slate
      jest.clearAllMocks();

      // Mock repository behavior
      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);
      mockTrusteesRepository.createTrusteeHistory.mockResolvedValue(undefined);

      // Execute the function
      await useCase.updateTrustee(context, trusteeId, updateInput);

      // Verify createHistory is called for the name audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          id: trusteeId,
          before: existingTrustee.name,
          after: updatedTrustee.name,
        }),
      );

      // Verify createHistory is called for the public contact audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updatedTrustee.public,
        }),
      );
    });

    test('should not create name history record when name is unchanged', async () => {
      const trusteeId = 'trustee-123';
      const unchangedName = 'John Doe Unchanged';

      // Setup with name that remains the same between existing and updated trustees
      const existingTrustee = {
        id: trusteeId,
        name: unchangedName,
        public: {
          address: {
            address1: '123 Old St',
            city: 'Oldtown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US' as const,
          },
        },
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updatedPublicInfo = {
        address: {
          address1: '789 Update Ave',
          city: 'Updatetown',
          state: 'TX',
          zipCode: '67890',
          countryCode: 'US' as const,
        },
        phone: {
          number: '333-555-4567',
        },
        email: 'john.updated@example.com',
      };

      const updatedTrustee = {
        id: trusteeId,
        name: unchangedName, // Name remains the same
        public: updatedPublicInfo,
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput = {
        name: unchangedName, // Include name in input but with same value
        public: updatedPublicInfo,
        status: 'active' as const,
      };

      // Override the deepEqual mock for this specific test to properly test both branches
      (deepEqual as jest.Mock).mockImplementationOnce((_a, _b) => false); // Make public contact comparison return false

      // Reset mock history before test
      jest.clearAllMocks();

      // Mock repository behavior
      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);
      mockTrusteesRepository.createTrusteeHistory.mockResolvedValue(undefined);

      // Execute the function
      await useCase.updateTrustee(context, trusteeId, updateInput);

      // Verify createHistory is NOT called for name (should never receive AUDIT_NAME document type)
      expect(mockTrusteesRepository.createTrusteeHistory).not.toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
        }),
      );

      // Verify createHistory IS called for the public contact audit record
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updatedTrustee.public,
        }),
      );

      // Verify total number of createHistory calls (should be 1 for public contact only)
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledTimes(1);
    });

    test('should handle validation error with undefined reasonMap for update', async () => {
      const trusteeId = 'trustee-123';
      mockTrusteesRepository.updateTrustee = jest
        .fn()
        .mockRejectedValue(new Error('should not be called'));

      const mockValidationResult = { reasonMap: undefined };
      jest.spyOn(validationModule, 'validateObject').mockReturnValue(mockValidationResult);

      const invalidInput = { name: '', status: 'active' } as TrusteeInput;

      await expect(useCase.updateTrustee(context, trusteeId, invalidInput)).rejects.toThrow(
        'Trustee validation failed: .',
      );

      expect(mockTrusteesRepository.updateTrustee).not.toHaveBeenCalled();
    });

    test('should handle trustee not found error', async () => {
      const trusteeId = 'nonexistent-trustee';
      const repositoryError = new Error(`Trustee with ID ${trusteeId} not found.`);
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: `Trustee with ID ${trusteeId} not found.`,
      });

      mockTrusteesRepository.updateTrustee = jest.fn().mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.updateTrustee(context, trusteeId, sampleTrusteeInput)).rejects.toThrow(
        expectedCamsError,
      );

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });

    test('should not create public contact history record when public contact info is unchanged', async () => {
      const trusteeId = 'trustee-123';
      const unchangedName = 'John Doe';

      // Create public contact information that will be the same in both objects
      const unchangedPublicInfo = {
        address: {
          address1: '123 Unchanged St',
          city: 'Sametown',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US' as const,
        },
        phone: {
          number: '333-555-1234',
        },
        email: 'john.same@example.com',
      };

      // Setup with public contact info that remains the same between existing and updated trustees
      const existingTrustee = {
        id: trusteeId,
        name: unchangedName,
        public: unchangedPublicInfo,
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      // Updated trustee has the same public contact info but different name
      const updatedTrustee = {
        id: trusteeId,
        name: 'Jane Doe Updated', // Name changes
        public: unchangedPublicInfo, // Public contact remains the same
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput = {
        name: 'Jane Doe Updated',
        public: unchangedPublicInfo,
        status: 'active' as const,
      };

      // Override the deepEqual mock for this specific test to return true for public contact comparison
      // This simulates the case where the public contact info is equal between existing and updated trustee
      (deepEqual as jest.Mock).mockImplementationOnce((a, b) => {
        if (a === existingTrustee.public && b === updatedTrustee.public) {
          return true; // Public contacts are equal
        }
        return false; // For any other comparison
      });

      // Reset mock history before test
      jest.clearAllMocks();

      // Mock repository behavior
      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);
      mockTrusteesRepository.createTrusteeHistory.mockResolvedValue(undefined);

      // Execute the function
      await useCase.updateTrustee(context, trusteeId, updateInput);

      // Verify createHistory IS called for name (since name changed)
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NAME',
          id: trusteeId,
          before: existingTrustee.name,
          after: updatedTrustee.name,
        }),
      );

      // Verify createHistory is NOT called for public contact (should never receive AUDIT_PUBLIC_CONTACT document type)
      expect(mockTrusteesRepository.createTrusteeHistory).not.toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
        }),
      );

      // Verify total number of createHistory calls (should be 1 for name only)
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledTimes(1);
    });

    test('should update Chapter 13 trustee website information and create history record', async () => {
      const trusteeId = 'trustee-456';

      const existingTrustee = {
        id: trusteeId,
        name: 'Jane Smith',
        public: {
          address: {
            address1: '789 Chapter 13 Ave',
            city: 'Consumer City',
            state: 'TX',
            zipCode: '77001',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0199',
            extension: '456',
          },
          email: 'jane.smith@ch13-trustee.com',
          website: 'https://www.oldwebsite-ch13.com', // Old website
        },
        internal: {
          address: {
            address1: '321 Internal Ave',
            city: 'Houston',
            state: 'TX',
            zipCode: '77002',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0100',
          },
          email: 'jane.smith.internal@ustp.gov',
          website: 'https://old-internal.janesmith-ch13.com', // Old internal website
        },
        districts: ['TX'],
        chapters: ['13'] as ChapterType[],
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput: TrusteeInput = {
        name: 'Jane Smith',
        public: {
          address: {
            address1: '789 Chapter 13 Ave',
            city: 'Consumer City',
            state: 'TX',
            zipCode: '77001',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0199',
            extension: '456',
          },
          email: 'jane.smith@ch13-trustee.com',
          website: 'https://www.newwebsite-ch13.com', // New website
        },
        internal: {
          address: {
            address1: '321 Internal Ave',
            city: 'Houston',
            state: 'TX',
            zipCode: '77002',
            countryCode: 'US' as const,
          },
          phone: {
            number: '713-555-0100',
          },
          email: 'jane.smith.internal@ustp.gov',
          website: 'https://new-internal.janesmith-ch13.com', // New internal website
        },
        districts: ['TX'],
        chapters: ['13'],
        status: 'active' as const,
      };

      const updatedTrustee = {
        ...updateInput,
        id: trusteeId,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await useCase.updateTrustee(context, trusteeId, updateInput);

      expect(result).toEqual(updatedTrustee);
      expect(mockTrusteesRepository.updateTrustee).toHaveBeenCalledWith(
        trusteeId,
        updateInput,
        mockUserReference,
      );

      // Verify website changes are captured in history
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updateInput.public,
        }),
      );

      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_INTERNAL_CONTACT',
          id: trusteeId,
          before: existingTrustee.internal,
          after: updateInput.internal,
        }),
      );

      // Verify website URLs are correctly updated
      expect(result.public.website).toBe('https://www.newwebsite-ch13.com');
      expect(result.internal?.website).toBe('https://new-internal.janesmith-ch13.com');
    });

    test('should add website to trustee that previously had no website', async () => {
      const trusteeId = 'trustee-789';

      const existingTrustee = {
        id: trusteeId,
        name: 'Bob Johnson',
        public: {
          address: {
            address1: '456 Public Ave',
            city: 'Public City',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US' as const,
          },
          phone: {
            number: '305-555-0123',
          },
          email: 'bob.johnson@ch13-trustee.com',
          // No website initially
        },
        districts: ['FL'],
        chapters: ['13'] as ChapterType[],
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput: TrusteeInput = {
        name: 'Bob Johnson',
        public: {
          address: {
            address1: '456 Public Ave',
            city: 'Public City',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US' as const,
          },
          phone: {
            number: '305-555-0123',
          },
          email: 'bob.johnson@ch13-trustee.com',
          website: 'https://www.bobjohnson-ch13.com', // Adding website
        },
        districts: ['FL'],
        chapters: ['13'],
        status: 'active' as const,
      };

      const updatedTrustee = {
        ...updateInput,
        id: trusteeId,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await useCase.updateTrustee(context, trusteeId, updateInput);

      expect(result).toEqual(updatedTrustee);
      expect(result.public.website).toBe('https://www.bobjohnson-ch13.com');

      // Verify contact history record is created for the website addition
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updateInput.public,
        }),
      );
    });

    test('should remove website from trustee', async () => {
      const trusteeId = 'trustee-888';

      const existingTrustee = {
        id: trusteeId,
        name: 'Carol Davis',
        public: {
          address: {
            address1: '999 Website St',
            city: 'Web City',
            state: 'WA',
            zipCode: '98101',
            countryCode: 'US' as const,
          },
          phone: {
            number: '206-555-0199',
          },
          email: 'carol.davis@ch13-trustee.com',
          website: 'https://www.caroldavis-ch13.com', // Has website
        },
        districts: ['WA'],
        chapters: ['13'] as ChapterType[],
        status: 'active' as const,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      const updateInput: TrusteeInput = {
        name: 'Carol Davis',
        public: {
          address: {
            address1: '999 Website St',
            city: 'Web City',
            state: 'WA',
            zipCode: '98101',
            countryCode: 'US' as const,
          },
          phone: {
            number: '206-555-0199',
          },
          email: 'carol.davis@ch13-trustee.com',
          // Website removed (undefined)
        },
        districts: ['WA'],
        chapters: ['13'],
        status: 'active' as const,
      };

      const updatedTrustee = {
        ...updateInput,
        id: trusteeId,
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T11:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.read.mockResolvedValue(existingTrustee);
      mockTrusteesRepository.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await useCase.updateTrustee(context, trusteeId, updateInput);

      expect(result).toEqual(updatedTrustee);
      expect(result.public.website).toBeUndefined();

      // Verify contact history record is created for the website removal
      expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_PUBLIC_CONTACT',
          id: trusteeId,
          before: existingTrustee.public,
          after: updateInput.public,
        }),
      );
    });
  });

  describe('listHistory', () => {
    test('should successfully retrieve history for a trustee by ID', async () => {
      const trusteeId = 'trustee-123';
      const mockHistory = [
        {
          documentType: 'AUDIT_NAME' as const,
          id: trusteeId,
          before: 'John Doe',
          after: 'John Smith',
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUserReference,
          updatedOn: '2025-08-12T10:00:00Z',
          updatedBy: mockUserReference,
        },
        {
          documentType: 'AUDIT_PUBLIC_CONTACT' as const,
          id: trusteeId,
          before: {
            address: {
              address1: '123 Old St',
              city: 'Oldtown',
              state: 'NY',
              zipCode: '12345',
              countryCode: 'US' as const,
            },
          },
          after: {
            address: {
              address1: '456 New St',
              city: 'Newtown',
              state: 'CA',
              zipCode: '54321',
              countryCode: 'US' as const,
            },
          },
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUserReference,
          updatedOn: '2025-08-12T10:00:00Z',
          updatedBy: mockUserReference,
        },
      ];

      mockTrusteesRepository.listTrusteeHistory.mockResolvedValue(mockHistory);

      const result = await useCase.listTrusteeHistory(context, trusteeId);

      expect(mockTrusteesRepository.listTrusteeHistory).toHaveBeenCalledWith(trusteeId);
      expect(result).toEqual(mockHistory);
    });

    test('should handle repository errors when retrieving history', async () => {
      const trusteeId = 'trustee-123';
      const repositoryError = new Error('Database connection failed');
      const expectedCamsError = new CamsError('TRUSTEES-USE-CASE', {
        message: 'Database connection failed',
      });

      mockTrusteesRepository.listTrusteeHistory.mockRejectedValue(repositoryError);
      mockGetCamsError.mockReturnValue(expectedCamsError);

      await expect(useCase.listTrusteeHistory(context, trusteeId)).rejects.toThrow(
        expectedCamsError,
      );

      expect(mockGetCamsError).toHaveBeenCalledWith(repositoryError, 'TRUSTEES-USE-CASE');
    });
  });
});
