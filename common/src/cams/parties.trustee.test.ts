import {
  ChapterType,
  TrusteeStatus,
  Trustee,
  isValidChapterType,
  isValidTrusteeStatus,
  validateTrusteeCreationFields,
  createDefaultTrusteeForCreation,
} from './parties';
import { CamsUserReference } from './users';

describe('Trustee Type Extensions', () => {
  describe('ChapterType validation', () => {
    test('should validate correct chapter types', () => {
      expect(isValidChapterType('7')).toBe(true);
      expect(isValidChapterType('11')).toBe(true);
      expect(isValidChapterType('12')).toBe(true);
      expect(isValidChapterType('13')).toBe(true);
    });

    test('should reject invalid chapter types', () => {
      expect(isValidChapterType('9')).toBe(false);
      expect(isValidChapterType('15')).toBe(false);
      expect(isValidChapterType('invalid')).toBe(false);
      expect(isValidChapterType('')).toBe(false);
    });
  });

  describe('TrusteeStatus validation', () => {
    test('should validate correct trustee status values', () => {
      expect(isValidTrusteeStatus('active')).toBe(true);
      expect(isValidTrusteeStatus('inactive')).toBe(true);
    });

    test('should reject invalid trustee status values', () => {
      expect(isValidTrusteeStatus('pending')).toBe(false);
      expect(isValidTrusteeStatus('suspended')).toBe(false);
      expect(isValidTrusteeStatus('')).toBe(false);
      expect(isValidTrusteeStatus('ACTIVE')).toBe(false);
    });
  });

  describe('validateTrusteeCreationFields', () => {
    test('should pass validation for valid trustee data', () => {
      const validTrustee: Partial<Trustee> = {
        name: 'John Doe',
        status: 'active',
        chapters: ['7', '11'],
        districts: ['NY', 'NJ'],
      };

      const errors = validateTrusteeCreationFields(validTrustee);
      expect(errors).toHaveLength(0);
    });

    test('should require trustee name', () => {
      const trusteeWithoutName: Partial<Trustee> = {
        status: 'active',
      };

      const errors = validateTrusteeCreationFields(trusteeWithoutName);
      expect(errors).toContain('Trustee name is required');
    });

    test('should reject empty or whitespace-only names', () => {
      const trusteeWithEmptyName: Partial<Trustee> = {
        name: '   ',
      };

      const errors = validateTrusteeCreationFields(trusteeWithEmptyName);
      expect(errors).toContain('Trustee name is required');
    });

    test('should validate chapter types when provided', () => {
      const trusteeWithInvalidChapters: Partial<Trustee> = {
        name: 'John Doe',
        chapters: ['7', '9', '15'] as ChapterType[],
      };

      const errors = validateTrusteeCreationFields(trusteeWithInvalidChapters);
      expect(errors).toContain('Invalid chapter types: 9, 15');
    });

    test('should validate status when provided', () => {
      const trusteeWithInvalidStatus: Partial<Trustee> = {
        name: 'John Doe',
        status: 'pending' as TrusteeStatus,
      };

      const errors = validateTrusteeCreationFields(trusteeWithInvalidStatus);
      expect(errors).toContain('Invalid trustee status: pending');
    });

    test('should reject empty districts array', () => {
      const trusteeWithEmptyDistricts: Partial<Trustee> = {
        name: 'John Doe',
        districts: [],
      };

      const errors = validateTrusteeCreationFields(trusteeWithEmptyDistricts);
      expect(errors).toContain('Districts array cannot be empty when provided');
    });

    test('should allow undefined optional fields', () => {
      const minimalTrustee: Partial<Trustee> = {
        name: 'John Doe',
      };

      const errors = validateTrusteeCreationFields(minimalTrustee);
      expect(errors).toHaveLength(0);
    });
  });

  describe('createDefaultTrusteeForCreation', () => {
    test('should create trustee with default values', () => {
      const defaultTrustee = createDefaultTrusteeForCreation('Jane Smith');

      expect(defaultTrustee).toEqual({
        name: 'Jane Smith',
        status: 'active',
        districts: [],
        chapters: [],
      });
    });
  });

  describe('Trustee type compatibility', () => {
    test('should be compatible with existing Trustee structure', () => {
      const existingTrustee: Trustee = {
        name: 'Legacy Trustee',
        address1: '123 Main St',
        cityStateZipCountry: 'Anytown, NY 12345',
        phone: '555-0123',
        email: 'trustee@example.com',
      } as Trustee;

      // Should not cause type errors
      expect(existingTrustee.name).toBe('Legacy Trustee');
      expect(existingTrustee.id).toBeUndefined();
      expect(existingTrustee.status).toBeUndefined();
    });

    test('should support new creation fields', () => {
      const mockUser: CamsUserReference = { id: 'user123', name: 'Admin User' };

      const newTrustee: Trustee = {
        name: 'New Trustee',
        address1: '456 Oak Ave',
        cityStateZipCountry: 'Other City, CA 90210',
        phone: '555-0456',
        email: 'new.trustee@example.com',
        id: 'trustee-123',
        districts: ['CA', 'NV'],
        chapters: ['7', '11', '13'],
        status: 'active',
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUser,
      };

      expect(newTrustee.id).toBe('trustee-123');
      expect(newTrustee.status).toBe('active');
      expect(newTrustee.districts).toEqual(['CA', 'NV']);
      expect(newTrustee.chapters).toEqual(['7', '11', '13']);
      expect(newTrustee.createdBy).toEqual(mockUser);
    });
  });
});
