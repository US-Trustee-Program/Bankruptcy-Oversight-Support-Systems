import { describe, test, expect } from 'vitest';
import { validateObject, VALID } from './validation';
import {
  typedPhoneNumberSpec,
  phoneNumber,
  phoneExtension,
  email,
  website,
} from './contact-validators';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';

describe('contact-validators', () => {
  describe('phoneNumber', () => {
    test.each([
      { value: '123-456-7890', expected: VALID },
      { value: '1-123-456-7890', expected: VALID },
      { value: '(123) 456-7890', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: '1234567890', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: '123-45-6789', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
      { value: 'invalid', expected: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_NUMBER] } },
    ])('should validate phone number: $value', ({ value, expected }) => {
      expect(phoneNumber(value)).toEqual(expected);
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
      expect(phoneExtension(value)).toEqual(expected);
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
      expect(email(value)).toEqual(expected);
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
      expect(website(value)).toEqual(expected);
    });
  });

  describe('typedPhoneNumberSpec', () => {
    test('should pass for a valid direct phone', () => {
      expect(
        validateObject(typedPhoneNumberSpec, { number: '303-555-1234', type: 'direct' }),
      ).toEqual(VALID);
    });

    test('should pass for a valid phone with extension', () => {
      expect(
        validateObject(typedPhoneNumberSpec, {
          number: '303-555-1234',
          type: 'office',
          extension: '42',
        }),
      ).toEqual(VALID);
    });

    test.each(['direct', 'fax', 'home', 'office', 'personalMobile', 'workMobile'])(
      'should pass for type: %s',
      (type) => {
        expect(validateObject(typedPhoneNumberSpec, { number: '303-555-1234', type })).toEqual(
          VALID,
        );
      },
    );

    test('should fail for an unrecognized phone type', () => {
      const result = validateObject(typedPhoneNumberSpec, {
        number: '303-555-1234',
        type: 'bogus',
      });
      expect(result.valid).toBeUndefined();
      expect(result.reasonMap?.['type']).toBeDefined();
    });

    test('should fail for an empty phone type', () => {
      const result = validateObject(typedPhoneNumberSpec, { number: '303-555-1234', type: '' });
      expect(result.valid).toBeUndefined();
      expect(result.reasonMap?.['type']).toBeDefined();
    });

    test('should fail for an invalid phone number', () => {
      const result = validateObject(typedPhoneNumberSpec, { number: '123', type: 'direct' });
      expect(result.valid).toBeUndefined();
      expect(result.reasonMap?.['number']).toBeDefined();
    });
  });
});
