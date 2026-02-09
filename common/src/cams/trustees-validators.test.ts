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
      { value: 'a'.repeat(40) + '@test.com', expected: VALID },
      { value: 'invalid', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      { value: '@example.com', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      { value: 'user@', expected: { reasons: [FIELD_VALIDATION_MESSAGES.EMAIL] } },
      {
        value: 'a'.repeat(50) + '@test.com',
        expected: { reasons: ['Max length 50 characters'] },
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
          reasons: [FIELD_VALIDATION_MESSAGES.ZOOM_LINK, FIELD_VALIDATION_MESSAGES.ZOOM_LINK],
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

  describe('assistantName', () => {
    test.each([
      { value: 'Jane Doe', expected: VALID },
      { value: 'A', expected: VALID },
      { value: '', expected: { reasons: ['Min length 1 character'] } },
    ])('should validate assistant name: $value', ({ value, expected }) => {
      expect(TV.assistantName(value)).toEqual(expected);
    });
  });

  describe('assistantTitle', () => {
    test.each([
      { value: 'Legal Assistant', expected: VALID },
      { value: 'x'.repeat(50), expected: VALID },
      { value: 'x'.repeat(51), expected: { reasons: ['Max length 50 characters'] } },
    ])('should validate assistant title: $value', ({ value, expected }) => {
      expect(TV.assistantTitle(value)).toEqual(expected);
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

  describe('assistantInputSpec', () => {
    test('should validate assistant with only name (required field)', () => {
      const minimalAssistant = {
        name: 'Jane Doe',
      };

      const result = validateObject(TV.assistantInputSpec, minimalAssistant);
      expect(result).toEqual(VALID);
    });

    test('should validate assistant with name and title', () => {
      const assistant = {
        name: 'Jane Doe',
        title: 'Legal Assistant',
      };

      const result = validateObject(TV.assistantInputSpec, assistant);
      expect(result).toEqual(VALID);
    });

    test('should validate assistant with complete contact information', () => {
      const fullAssistant = {
        name: 'Jane Doe',
        title: 'Legal Assistant',
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

      const result = validateObject(TV.assistantInputSpec, fullAssistant);
      expect(result).toEqual(VALID);
    });

    test('should reject assistant with empty name', () => {
      const invalidAssistant = {
        name: '',
      };

      const result = validateObject(TV.assistantInputSpec, invalidAssistant);
      expect(result.reasonMap?.name).toBeDefined();
    });

    test('should reject assistant with title too long', () => {
      const invalidAssistant = {
        name: 'Jane Doe',
        title: 'x'.repeat(51),
      };

      const result = validateObject(TV.assistantInputSpec, invalidAssistant);
      expect(result.reasonMap?.title).toBeDefined();
      expect(result.reasonMap?.title?.reasons).toContain('Max length 50 characters');
    });

    test('should reject assistant with invalid nested contact', () => {
      const invalidAssistant = {
        name: 'Jane Doe',
        contact: {
          email: 'invalid-email',
        },
      };

      const result = validateObject(TV.assistantInputSpec, invalidAssistant);
      expect(result.reasonMap?.contact).toBeDefined();
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
  });
});
