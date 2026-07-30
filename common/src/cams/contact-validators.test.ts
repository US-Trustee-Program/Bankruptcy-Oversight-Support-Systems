import { describe, test, expect } from 'vitest';
import { validateObject, VALID } from './validation';
import { typedPhoneNumberSpec } from './contact-validators';

describe('contact-validators', () => {
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
