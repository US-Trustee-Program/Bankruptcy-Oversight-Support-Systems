import { describe, test, expect } from 'vitest';
import { validateObject, VALID } from './validation';
import * as TV from './trustees-validators';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';
import MockData from './test-utilities/mock-data';

describe('trustees-validators', () => {
  describe('trusteeName', () => {
    test.each([
      { value: 'John Doe', expected: VALID },
      { value: 'A', expected: VALID },
      { value: 'x'.repeat(50), expected: VALID },
      { value: '', expected: { reasons: ['Trustee name is required'] } },
      { value: 'x'.repeat(51), expected: { reasons: ['Max length 50 characters'] } },
    ])('should validate trustee name: $value', ({ value, expected }) => {
      expect(TV.trusteeName(value)).toEqual(expected);
    });
  });

  describe('trusteeFirstName', () => {
    test.each([
      { value: 'Jane', expected: VALID },
      { value: 'A', expected: VALID },
      { value: 'x'.repeat(15), expected: VALID },
      { value: '', expected: { reasons: ['First name is required'] } },
      { value: 'x'.repeat(16), expected: { reasons: ['Max length 15 characters'] } },
    ])('should validate trustee first name: $value', ({ value, expected }) => {
      expect(TV.trusteeFirstName(value)).toEqual(expected);
    });
  });

  describe('trusteeLastName', () => {
    test.each([
      { value: 'Doe', expected: VALID },
      { value: 'A', expected: VALID },
      { value: 'x'.repeat(20), expected: VALID },
      { value: '', expected: { reasons: ['Last name is required'] } },
      { value: 'x'.repeat(21), expected: { reasons: ['Max length 20 characters'] } },
    ])('should validate trustee last name: $value', ({ value, expected }) => {
      expect(TV.trusteeLastName(value)).toEqual(expected);
    });
  });

  describe('trusteeMiddleName', () => {
    test.each([
      { value: 'Ann', expected: VALID },
      { value: undefined, expected: VALID },
      { value: 'x'.repeat(15), expected: VALID },
      { value: 'x'.repeat(16), expected: { reasons: ['Max length 15 characters'] } },
    ])('should validate trustee middle name: $value', ({ value, expected }) => {
      expect(TV.trusteeMiddleName(value)).toEqual(expected);
    });
  });

  describe('companyName', () => {
    test.each([
      { value: 'Acme Corp', expected: VALID },
      { value: 'x'.repeat(50), expected: VALID },
      { value: undefined, expected: VALID },
      { value: '', expected: VALID },
      { value: 'x'.repeat(51), expected: { reasons: ['Max length 50 characters'] } },
    ])('should validate company name: $value', ({ value, expected }) => {
      expect(TV.companyName(value)).toEqual(expected);
    });
  });

  describe('addressLine1', () => {
    test.each([
      { value: '123 Main St', expected: VALID },
      { value: 'A', expected: VALID },
      { value: 'x'.repeat(40), expected: VALID },
      { value: '', expected: { reasons: [FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED] } },
      { value: 'x'.repeat(41), expected: { reasons: ['Max length 40 characters'] } },
    ])('should validate address line 1: $value', ({ value, expected }) => {
      expect(TV.addressLine1(value)).toEqual(expected);
    });
  });

  describe('addressLine2', () => {
    test.each([
      { value: 'Apt 4B', expected: VALID },
      { value: undefined, expected: VALID },
      { value: '', expected: VALID },
      { value: 'x'.repeat(40), expected: VALID },
      { value: 'x'.repeat(41), expected: { reasons: ['Max length 40 characters'] } },
    ])('should validate address line 2: $value', ({ value, expected }) => {
      expect(TV.addressLine2(value)).toEqual(expected);
    });
  });

  describe('addressLine3', () => {
    test.each([
      { value: 'Building C', expected: VALID },
      { value: undefined, expected: VALID },
      { value: '', expected: VALID },
      { value: 'x'.repeat(40), expected: VALID },
      { value: 'x'.repeat(41), expected: { reasons: ['Max length 40 characters'] } },
    ])('should validate address line 3: $value', ({ value, expected }) => {
      expect(TV.addressLine3(value)).toEqual(expected);
    });
  });

  describe('city', () => {
    test.each([
      { value: 'New York', expected: VALID },
      { value: 'A', expected: VALID },
      { value: 'x'.repeat(50), expected: VALID },
      { value: '', expected: { reasons: [FIELD_VALIDATION_MESSAGES.CITY_REQUIRED] } },
      { value: 'x'.repeat(51), expected: { reasons: ['Max length 50 characters'] } },
    ])('should validate city: $value', ({ value, expected }) => {
      expect(TV.city(value)).toEqual(expected);
    });
  });

  describe('state', () => {
    test.each([
      { value: 'NY', expected: VALID },
      { value: 'CA', expected: VALID },
      { value: '', expected: { reasons: [FIELD_VALIDATION_MESSAGES.STATE_REQUIRED] } },
      { value: 'N', expected: { reasons: [FIELD_VALIDATION_MESSAGES.STATE_REQUIRED] } },
      { value: 'NYC', expected: { reasons: [FIELD_VALIDATION_MESSAGES.STATE_REQUIRED] } },
    ])('should validate state: $value', ({ value, expected }) => {
      expect(TV.state(value)).toEqual(expected);
    });
  });

  describe('zipCode', () => {
    test.each([
      { value: '12345', expected: VALID },
      { value: '12345-6789', expected: VALID },
      {
        value: '',
        expected: {
          reasons: [FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED],
        },
      },
      { value: '1234', expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZIP_CODE] } },
      { value: 'ABCDE', expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZIP_CODE] } },
    ])('should validate zip code: $value', ({ value, expected }) => {
      expect(TV.zipCode(value)).toEqual(expected);
    });
  });

  describe('countryCode', () => {
    test.each([
      { value: 'US', expected: VALID },
      { value: 'CA', expected: VALID },
      { value: '', expected: { reasons: ['Should be 2 characters in length'] } },
      { value: 'U', expected: { reasons: ['Should be 2 characters in length'] } },
      { value: 'USA', expected: { reasons: ['Should be 2 characters in length'] } },
    ])('should validate country code: $value', ({ value, expected }) => {
      expect(TV.countryCode(value)).toEqual(expected);
    });
  });

  describe('phoneNumber', () => {
    test.each([
      { value: '123-456-7890', expected: VALID },
      { value: '1-123-456-7890', expected: VALID },
      { value: '(123) 456-7890', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: '1234567890', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: '123-45-6789', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: 'invalid', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
    ])('should validate phone number: $value', ({ value, expected }) => {
      expect(TV.phoneNumber(value)).toEqual(expected);
    });
  });

  describe('phoneExtension', () => {
    test.each([
      { value: '123', expected: VALID },
      { value: '12345', expected: VALID },
      { value: undefined, expected: VALID },
      { value: 'abc', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION] } },
      { value: '12345678', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION] } },
    ])('should validate phone extension: $value', ({ value, expected }) => {
      expect(TV.phoneExtension(value)).toEqual(expected);
    });
  });

  describe('email', () => {
    test.each([
      { value: 'user@example.com', expected: VALID },
      { value: 'test.user+tag@domain.co.uk', expected: VALID },
      { value: 'a'.repeat(244) + '@test.com', expected: VALID },
      { value: 'invalid', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      { value: '@example.com', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      { value: 'user@', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      {
        value: 'a'.repeat(255) + '@test.com',
        expected: { reasons: ['Max length 254 characters'] },
      },
      {
        value: undefined,
        expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] },
      },
    ])('should validate email: $value', ({ value, expected }) => {
      expect(TV.email(value)).toEqual(expected);
    });
  });

  describe('website', () => {
    test.each([
      { value: 'https://example.com', expected: VALID },
      { value: 'http://example.com', expected: VALID },
      { value: 'www.example.com', expected: VALID },
      { value: undefined, expected: VALID },
      { value: null, expected: VALID },
      { value: '', expected: VALID },
      {
        value: 'invalid website',
        expected: { reasons: [FIELD_VALIDATION_MESSAGES.WEBSITE] },
      },
      {
        value: 'https://' + 'a'.repeat(250) + '.com',
        expected: {
          reasons: [
            FIELD_VALIDATION_MESSAGES.WEBSITE,
            FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH,
          ],
        },
      },
    ])('should validate website: $value', ({ value, expected }) => {
      expect(TV.website(value)).toEqual(expected);
    });
  });

  describe('zoomLink', () => {
    test.each([
      { value: 'https://zoom.us/j/123456789', expected: VALID },
      { value: 'https://us02web.zoom.us/j/123', expected: VALID },
      { value: 'zoom.us', expected: VALID },
      {
        value: '',
        expected: {
          reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_LINK],
        },
      },
      {
        value: 'invalid link',
        expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_LINK] },
      },
      {
        value: 'https://' + 'a'.repeat(250) + '.com',
        expected: {
          reasons: [
            FIELD_VALIDATION_MESSAGES.ZOOM_LINK,
            FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH,
          ],
        },
      },
    ])('should validate zoom link: $value', ({ value, expected }) => {
      expect(TV.zoomLink(value)).toEqual(expected);
    });
  });

  describe('zoomPhone', () => {
    test.each([
      { value: '123-456-7890', expected: VALID },
      { value: '1-123-456-7890', expected: VALID },
      { value: '(123) 456-7890', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: 'invalid', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
    ])('should validate zoom phone: $value', ({ value, expected }) => {
      expect(TV.zoomPhone(value)).toEqual(expected);
    });
  });

  describe('zoomMeetingId', () => {
    test.each([
      { value: '123456789', expected: VALID },
      { value: '12345678901', expected: VALID },
      { value: '123 456 789', expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID] } },
      { value: '123-456-789', expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID] } },
      {
        value: 'invalid',
        expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID] },
      },
      {
        value: '12-34-56',
        expected: { reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID] },
      },
    ])('should validate zoom meeting ID: $value', ({ value, expected }) => {
      expect(TV.zoomMeetingId(value)).toEqual(expected);
    });
  });

  describe('zoomPasscode', () => {
    test.each([
      { value: '123456', expected: VALID },
      { value: 'abc123', expected: VALID },
      { value: 'x', expected: VALID },
      { value: '', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED] } },
    ])('should validate zoom passcode: $value', ({ value, expected }) => {
      expect(TV.zoomPasscode(value)).toEqual(expected);
    });
  });

  describe('staffName', () => {
    test.each([
      { value: 'Jane Doe', expected: VALID },
      { value: 'A', expected: VALID },
      { value: '', expected: { reasons: ['Min length 1 character'] } },
    ])('should validate staff member name: $value', ({ value, expected }) => {
      expect(TV.staffName(value)).toEqual(expected);
    });
  });

  describe('staffTitle', () => {
    test.each([
      { value: 'Legal Staff', expected: VALID },
      { value: 'x'.repeat(50), expected: VALID },
      { value: 'x'.repeat(51), expected: { reasons: ['Max length 50 characters'] } },
    ])('should validate staff member title: $value', ({ value, expected }) => {
      expect(TV.staffTitle(value)).toEqual(expected);
    });
  });

  describe('addressSpec', () => {
    test('should validate complete address', () => {
      const validAddress = {
        address1: '123 Main St',
        address2: 'Apt 4B',
        address3: '',
        city: 'New York',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      };

      const result = validateObject(TV.addressSpec, validAddress);
      expect(result).toEqual(VALID);
    });

    test('should reject address with missing required fields', () => {
      const invalidAddress = {
        address1: '',
        address2: '',
        address3: '',
        city: '',
        state: '',
        zipCode: '',
        countryCode: 'US',
      };

      const result = validateObject(TV.addressSpec, invalidAddress);
      expect(result.reasonMap).toHaveProperty('address1');
      expect(result.reasonMap).toHaveProperty('city');
      expect(result.reasonMap).toHaveProperty('state');
      expect(result.reasonMap).toHaveProperty('zipCode');
    });

    test('should reject address with invalid zip code', () => {
      const invalidAddress = {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: 'ABCDE',
        countryCode: 'US',
      };

      const result = validateObject(TV.addressSpec, invalidAddress);
      expect(result.reasonMap?.zipCode).toBeDefined();
      expect(result.reasonMap?.zipCode?.reasons).toContain(FIELD_VALIDATION_MESSAGES.ZIP_CODE);
    });
  });

  describe('phoneSpec', () => {
    test('should validate phone with number only', () => {
      const validPhone = {
        number: '123-456-7890',
      };

      const result = validateObject(TV.phoneSpec, validPhone);
      expect(result).toEqual(VALID);
    });

    test('should validate phone with number and extension', () => {
      const validPhone = {
        number: '123-456-7890',
        extension: '123',
      };

      const result = validateObject(TV.phoneSpec, validPhone);
      expect(result).toEqual(VALID);
    });

    test('should reject invalid phone number', () => {
      const invalidPhone = {
        number: 'invalid',
      };

      const result = validateObject(TV.phoneSpec, invalidPhone);
      expect(result.reasonMap?.number).toBeDefined();
      expect(result.reasonMap?.number?.reasons).toContain(FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);
    });

    test('should reject invalid extension', () => {
      const invalidPhone = {
        number: '123-456-7890',
        extension: 'abcdefgh',
      };

      const result = validateObject(TV.phoneSpec, invalidPhone);
      expect(result.reasonMap?.extension).toBeDefined();
      expect(result.reasonMap?.extension?.reasons).toContain(
        FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION,
      );
    });
  });

  describe('contactInformationSpec', () => {
    test('should validate complete contact information', () => {
      const validContact = {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
        phone: {
          number: '123-456-7890',
          extension: '123',
        },
        email: 'user@example.com',
        website: 'https://example.com',
        companyName: 'Acme Corp',
      };

      const result = validateObject(TV.contactInformationSpec, validContact);
      expect(result).toEqual(VALID);
    });

    test('should validate contact with only required address fields', () => {
      const minimalContact = {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
      };

      const result = validateObject(TV.contactInformationSpec, minimalContact);
      expect(result).toEqual(VALID);
    });

    test('should reject contact with invalid nested address', () => {
      const invalidContact = {
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      };

      const result = validateObject(TV.contactInformationSpec, invalidContact);
      expect(result.reasonMap?.address).toBeDefined();
    });

    test('should reject contact with invalid email', () => {
      const invalidContact = {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        },
        email: 'invalid-email',
      };

      const result = validateObject(TV.contactInformationSpec, invalidContact);
      expect(result.reasonMap?.email).toBeDefined();
      expect(result.reasonMap?.email?.reasons).toContain(FIELD_VALIDATION_MESSAGES.EMAIL);
    });
  });

  describe('staffInputSpec', () => {
    test('should validate staff member with only name (required field)', () => {
      const minimalStaff = {
        name: 'Jane Doe',
      };

      const result = validateObject(TV.staffInputSpec, minimalStaff);
      expect(result).toEqual(VALID);
    });

    test('should validate staff member with name and title', () => {
      const staffMember = {
        name: 'Jane Doe',
        title: 'Legal Staff',
      };

      const result = validateObject(TV.staffInputSpec, staffMember);
      expect(result).toEqual(VALID);
    });

    test('should validate staff member with complete contact information', () => {
      const fullStaff = {
        name: 'Jane Doe',
        title: 'Legal Staff',
        contact: {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          phone: {
            number: '123-456-7890',
          },
          email: 'jane@example.com',
        },
      };

      const result = validateObject(TV.staffInputSpec, fullStaff);
      expect(result).toEqual(VALID);
    });

    test('should reject staff member with empty name', () => {
      const invalidStaff = {
        name: '',
      };

      const result = validateObject(TV.staffInputSpec, invalidStaff);
      expect(result.reasonMap?.name).toBeDefined();
    });

    test('should reject staff member with title too long', () => {
      const invalidStaff = {
        name: 'Jane Doe',
        title: 'x'.repeat(51),
      };

      const result = validateObject(TV.staffInputSpec, invalidStaff);
      expect(result.reasonMap?.title).toBeDefined();
      expect(result.reasonMap?.title?.reasons).toContain('Max length 50 characters');
    });

    test('should reject staff member with invalid nested contact', () => {
      const invalidStaff = {
        name: 'Jane Doe',
        contact: {
          email: 'invalid-email',
        },
      };

      const result = validateObject(TV.staffInputSpec, invalidStaff);
      expect(result.reasonMap?.contact).toBeDefined();
    });
  });

  describe('FULL_NAME_MAX constant', () => {
    test('should equal FIRST_NAME_MAX + MIDDLE_NAME_MAX + LAST_NAME_MAX + 2 (spaces between names)', () => {
      // Kills all three ArithmeticOperator mutants on line 23 (-, - operators replacing +)
      expect(TV.FULL_NAME_MAX).toEqual(
        TV.FIRST_NAME_MAX + TV.MIDDLE_NAME_MAX + TV.LAST_NAME_MAX + 2,
      );
    });

    test('should equal 52', () => {
      // Explicitly pins the expected computed value (15 + 15 + 20 + 2 = 52)
      expect(TV.FULL_NAME_MAX).toEqual(52);
    });
  });

  describe('zoomInfoSpec', () => {
    test('should validate complete zoom info', () => {
      const validZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: '123-456-7890',
        meetingId: '123456789',
        passcode: MockData.randomAlphaNumeric(6),
      };

      const result = validateObject(TV.zoomInfoSpec, validZoom);
      expect(result).toEqual(VALID);
    });

    test('should validate zoom info with accountEmail', () => {
      const validZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: '123-456-7890',
        meetingId: '123456789',
        passcode: MockData.randomAlphaNumeric(6),
        accountEmail: 'trustee@example.com',
      };

      const result = validateObject(TV.zoomInfoSpec, validZoom);
      expect(result).toEqual(VALID);
    });

    test('should reject zoom info with invalid accountEmail', () => {
      const invalidZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: '123-456-7890',
        meetingId: '123456789',
        passcode: MockData.randomAlphaNumeric(6),
        accountEmail: 'not-an-email',
      };

      const result = validateObject(TV.zoomInfoSpec, invalidZoom);
      expect(result.reasonMap?.accountEmail).toBeDefined();
      expect(result.reasonMap?.accountEmail?.reasons).toContain(FIELD_VALIDATION_MESSAGES.EMAIL);
    });

    test('should reject zoom info with invalid link', () => {
      const invalidZoom = {
        link: 'invalid link',
        phone: '123-456-7890',
        meetingId: '123456789',
        passcode: MockData.randomAlphaNumeric(6),
      };

      const result = validateObject(TV.zoomInfoSpec, invalidZoom);
      expect(result.reasonMap?.link).toBeDefined();
      expect(result.reasonMap?.link?.reasons).toContain(FIELD_VALIDATION_MESSAGES.ZOOM_LINK);
    });

    test('should reject zoom info with invalid meeting ID', () => {
      const invalidZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: '123-456-7890',
        meetingId: 'invalid',
        passcode: MockData.randomAlphaNumeric(6),
      };

      const result = validateObject(TV.zoomInfoSpec, invalidZoom);
      expect(result.reasonMap?.meetingId).toBeDefined();
      expect(result.reasonMap?.meetingId?.reasons).toContain(
        FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID,
      );
    });

    test('should reject zoom info with empty passcode', () => {
      const invalidZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: '123-456-7890',
        meetingId: '123456789',
        passcode: '',
      };

      const result = validateObject(TV.zoomInfoSpec, invalidZoom);
      expect(result.reasonMap?.passcode).toBeDefined();
      expect(result.reasonMap?.passcode?.reasons).toContain(
        FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED,
      );
    });

    test('should reject zoom info with invalid phone number format', () => {
      // Kills ArrayDeclaration mutant: phone: [] (line 92) — empty array skips phone validation
      const invalidZoom = {
        link: 'https://zoom.us/j/123456789',
        phone: 'not-a-phone',
        meetingId: '123456789',
        passcode: MockData.randomAlphaNumeric(6),
      };

      const result = validateObject(TV.zoomInfoSpec, invalidZoom);
      expect(result.reasonMap?.phone).toBeDefined();
      expect(result.reasonMap?.phone?.reasons).toContain(FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);
    });
  });

  describe('addressSpec - optional field validation', () => {
    test('should reject address with address2 exceeding max length', () => {
      // Kills ArrayDeclaration mutant: address2: [] (line 100)
      const address = {
        address1: '123 Main St',
        address2: 'x'.repeat(41),
        city: 'New York',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      };

      const result = validateObject(TV.addressSpec, address);
      expect(result.reasonMap?.address2).toBeDefined();
      expect(result.reasonMap?.address2?.reasons).toContain('Max length 40 characters');
    });

    test('should reject address with address3 exceeding max length', () => {
      // Kills ArrayDeclaration mutant: address3: [] (line 101)
      const address = {
        address1: '123 Main St',
        address3: 'x'.repeat(41),
        city: 'New York',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      };

      const result = validateObject(TV.addressSpec, address);
      expect(result.reasonMap?.address3).toBeDefined();
      expect(result.reasonMap?.address3?.reasons).toContain('Max length 40 characters');
    });

    test('should reject address with invalid countryCode', () => {
      // Kills ArrayDeclaration mutant: countryCode: [] (line 105)
      const address = {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'USA',
      };

      const result = validateObject(TV.addressSpec, address);
      expect(result.reasonMap?.countryCode).toBeDefined();
      expect(result.reasonMap?.countryCode?.reasons).toContain('Should be 2 characters in length');
    });
  });

  describe('contactInformationSpec - optional field validation', () => {
    const baseAddress = {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    };

    test('should reject contact with invalid phone number format', () => {
      // Kills ArrayDeclaration mutant: phone: [] in contactInformationSpec (line 115)
      const contact = {
        address: baseAddress,
        phone: { number: 'bad-number' },
      };

      const result = validateObject(TV.contactInformationSpec, contact);
      expect(result.reasonMap?.phone).toBeDefined();
    });

    test('should reject contact with invalid website', () => {
      // Kills ArrayDeclaration mutant: website: [] (line 117)
      const contact = {
        address: baseAddress,
        website: 'not a valid website!!',
      };

      const result = validateObject(TV.contactInformationSpec, contact);
      expect(result.reasonMap?.website).toBeDefined();
      expect(result.reasonMap?.website?.reasons).toContain(FIELD_VALIDATION_MESSAGES.WEBSITE);
    });

    test('should reject contact with companyName exceeding max length', () => {
      // Kills ArrayDeclaration mutant: companyName: [] (line 118)
      const contact = {
        address: baseAddress,
        companyName: 'x'.repeat(51),
      };

      const result = validateObject(TV.contactInformationSpec, contact);
      expect(result.reasonMap?.companyName).toBeDefined();
      expect(result.reasonMap?.companyName?.reasons).toContain('Max length 50 characters');
    });
  });

  describe('trusteeContactSpec - optional address', () => {
    test('should accept missing address for staff contact (address is optional)', () => {
      const contact = {
        email: 'staff@example.com',
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      // address is optional in trusteeContactSpec, so missing address is valid
      expect(result.reasonMap?.address).toBeUndefined();
    });

    test('should reject staff member contact with invalid address when provided', () => {
      const contact = {
        address: {
          address1: '',
          city: '',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      // When address IS provided, it must be valid
      expect(result.reasonMap?.address).toBeDefined();
    });
  });

  describe('trusteeContactSpec - typed phones', () => {
    test('should accept multiple phones with distinct types', () => {
      const contact = {
        phones: [
          { number: '555-123-4567', type: 'direct' },
          { number: '555-987-6543', type: 'personalMobile' },
        ],
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones).toBeUndefined();
    });

    test('should accept multiple phones with the same type', () => {
      const contact = {
        phones: [
          { number: '555-123-4567', type: 'direct' },
          { number: '555-987-6543', type: 'direct' },
        ],
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones).toBeUndefined();
    });

    test('should reject an invalid phone number format', () => {
      const contact = {
        phones: [{ number: 'not-a-phone', type: 'direct' }],
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones).toBeDefined();
    });

    test('should accept exactly the maximum number of phones', () => {
      const contact = {
        phones: Array.from({ length: 20 }, (_, i) => ({
          number: `555-000-${String(i).padStart(4, '0')}`,
          type: 'direct',
        })),
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones).toBeUndefined();
    });

    test('should reject more than the maximum number of phones', () => {
      const contact = {
        phones: Array.from({ length: 21 }, (_, i) => ({
          number: `555-000-${String(i).padStart(4, '0')}`,
          type: 'direct',
        })),
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones?.reasons).toContain(
        'No more than 20 phone numbers are allowed.',
      );
    });

    test('should accept missing phones (phones is optional)', () => {
      const contact = {
        email: 'staff@example.com',
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones).toBeUndefined();
    });

    test('should reject a phone with a missing type', () => {
      const contact = {
        phones: [{ number: '555-123-4567', type: '' }],
      };

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones?.reasons?.[0]).toContain('Phone type is required');
    });

    test('should reject a non-array phones value without throwing', () => {
      const contact = {
        phones: 'not-an-array',
      };

      expect(() => validateObject(TV.trusteeContactSpec, contact)).not.toThrow();

      const result = validateObject(TV.trusteeContactSpec, contact);
      expect(result.reasonMap?.phones?.reasons).toContain('Value is not an array');
    });
  });
});
