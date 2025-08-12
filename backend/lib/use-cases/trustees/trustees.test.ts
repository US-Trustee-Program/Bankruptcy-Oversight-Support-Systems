// Mock the validation - need to import actual then mock specific functions
jest.mock('../../../../common/src/cams/parties', () => {
  const actualParties = jest.requireActual('../../../../common/src/cams/parties');
  return {
    ...actualParties,
    validateTrusteeCreationFields: jest.fn(),
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
import { validateTrusteeCreationFields } from '../../../../common/src/cams/parties';

const mockGetTrusteesRepository = getTrusteesRepository as jest.MockedFunction<
  typeof getTrusteesRepository
>;

const mockGetCamsError = getCamsError as jest.MockedFunction<typeof getCamsError>;

const mockGetCamsUserReference = getCamsUserReference as jest.MockedFunction<
  typeof getCamsUserReference
>;

const mockValidateTrusteeCreationFields = validateTrusteeCreationFields as jest.MockedFunction<
  typeof validateTrusteeCreationFields
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
    address1: '123 Main St',
    cityStateZipCountry: 'Anytown, NY 12345',
    phone: '555-0123',
    email: 'john.doe@example.com',
    districts: ['NY'],
    chapters: ['7', '11'],
    status: 'active',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockTrusteesRepository = {
      createTrustee: jest.fn(),
      release: jest.fn(),
    } as jest.Mocked<TrusteesRepository>;

    mockGetTrusteesRepository.mockReturnValue(mockTrusteesRepository);
    mockGetCamsUserReference.mockReturnValue(mockUserReference);
    mockValidateTrusteeCreationFields.mockReturnValue([]);

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
    it('should create trustee successfully with valid input', async () => {
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

      expect(mockValidateTrusteeCreationFields).toHaveBeenCalledWith(sampleTrusteeInput);
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

    it('should set default values for missing optional fields', async () => {
      const trusteeInputWithoutOptionalFields: TrusteeInput = {
        name: 'Jane Smith',
        address1: '456 Oak St',
        cityStateZipCountry: 'Somewhere, CA 90210',
        phone: '555-0456',
        email: 'jane.smith@example.com',
      };

      const expectedTrustee = {
        id: 'trustee-456',
        ...trusteeInputWithoutOptionalFields,
        status: 'active' as const,
        districts: [],
        chapters: [],
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUserReference,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUserReference,
      };

      mockTrusteesRepository.createTrustee.mockResolvedValue(expectedTrustee);

      const result = await useCase.createTrustee(context, trusteeInputWithoutOptionalFields);

      expect(mockTrusteesRepository.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({
          ...trusteeInputWithoutOptionalFields,
          status: 'active',
          districts: [],
          chapters: [],
        }),
        mockUserReference,
      );
      expect(result).toEqual(expectedTrustee);
    });

    it('should throw error when validation fails', async () => {
      const validationErrors = ['Name is required', 'Email format is invalid'];
      mockValidateTrusteeCreationFields.mockReturnValue(validationErrors);

      const invalidTrusteeInput: TrusteeInput = {
        name: '',
        address1: '123 Main St',
        cityStateZipCountry: 'Anytown, NY 12345',
        phone: '555-0123',
        email: 'invalid-email',
      };

      await expect(useCase.createTrustee(context, invalidTrusteeInput)).rejects.toThrow(
        'Trustee validation failed: Name is required, Email format is invalid',
      );

      expect(mockTrusteesRepository.createTrustee).not.toHaveBeenCalled();
    });

    it('should handle repository errors and convert them to CAMS errors', async () => {
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
  });
});
