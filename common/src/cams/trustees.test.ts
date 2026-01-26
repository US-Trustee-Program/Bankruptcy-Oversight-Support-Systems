import {
  TRUSTEE_STATUS_VALUES,
  getAppointmentDetails,
  formatChapterType,
  formatAppointmentType,
  AppointmentChapterType,
  AppointmentType,
  TrusteeAssistant,
  TrusteeInput,
} from './trustees';
import {
  addressSpec,
  phoneSpec,
  contactInformationSpec,
  internalContactInformationSpec,
  assistantSpec,
  trusteeSpec,
} from './trustees-validators';
import { validateObject } from './validation';
import { Address, ContactInformation, PhoneNumber } from './contact';

describe('trustees', () => {
  test('TRUSTEE_STATUS_VALUES', () => {
    expect(TRUSTEE_STATUS_VALUES).toEqual(['active', 'not active', 'suspended']);
  });

  describe('formatChapterType', () => {
    test.each([
      ['7', '7'],
      ['11', '11'],
      ['11-subchapter-v', '11 Subchapter V'],
      ['12', '12'],
      ['13', '13'],
    ])('should format "%s" as "%s"', (input, expected) => {
      expect(formatChapterType(input as AppointmentChapterType)).toBe(expected);
    });
  });

  describe('formatAppointmentType', () => {
    test.each([
      ['panel', 'Panel'],
      ['off-panel', 'Off Panel'],
      ['case-by-case', 'Case by Case'],
      ['pool', 'Pool'],
      ['out-of-pool', 'Out of Pool'],
      ['standing', 'Standing'],
      ['elected', 'Elected'],
      ['converted-case', 'Converted Case'],
    ])('should format "%s" as "%s"', (input, expected) => {
      expect(formatAppointmentType(input as AppointmentType)).toBe(expected);
    });
  });

  describe('getAppointmentDetails', () => {
    test.each([
      ['7', 'panel', '7 - Panel'],
      ['7', 'off-panel', '7 - Off Panel'],
      ['7', 'elected', '7 - Elected'],
      ['7', 'converted-case', '7 - Converted Case'],
      ['11', 'case-by-case', '11 - Case by Case'],
      ['11-subchapter-v', 'pool', '11 Subchapter V - Pool'],
      ['11-subchapter-v', 'out-of-pool', '11 Subchapter V - Out of Pool'],
      ['12', 'standing', '12 - Standing'],
      ['12', 'case-by-case', '12 - Case by Case'],
      ['13', 'standing', '13 - Standing'],
      ['13', 'case-by-case', '13 - Case by Case'],
    ])(
      'should format chapter "%s" with type "%s" as "%s"',
      (chapter, appointmentType, expected) => {
        expect(
          getAppointmentDetails(
            chapter as AppointmentChapterType,
            appointmentType as AppointmentType,
          ),
        ).toBe(expected);
      },
    );
  });

  describe('Validation Specs', () => {
    describe('addressSpec', () => {
      test('should validate a valid address', () => {
        const validAddress: Address = {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, validAddress);
        expect(result.valid).toBe(true);
      });

      test('should validate address with address2 and address3', () => {
        const validAddress: Address = {
          address1: '123 Main St',
          address2: 'Apt 4B',
          address3: 'Building C',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, validAddress);
        expect(result.valid).toBe(true);
      });

      test('should validate address with 9-digit zip code', () => {
        const validAddress: Address = {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '12345-6789',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, validAddress);
        expect(result.valid).toBe(true);
      });

      test('should reject address with empty address1', () => {
        const invalidAddress: Address = {
          address1: '',
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, invalidAddress);
        expect(result.valid).toBeFalsy();
      });

      test('should reject address with invalid state length', () => {
        const invalidAddress: Address = {
          address1: '123 Main St',
          city: 'New York',
          state: 'NYC',
          zipCode: '12345',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, invalidAddress);
        expect(result.valid).toBeFalsy();
      });

      test('should reject address with invalid zip code format', () => {
        const invalidAddress: Address = {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '1234',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, invalidAddress);
        expect(result.valid).toBeFalsy();
      });

      test('should reject address with address2 exceeding max length', () => {
        const invalidAddress: Address = {
          address1: '123 Main St',
          address2: 'A'.repeat(51),
          city: 'New York',
          state: 'NY',
          zipCode: '12345',
          countryCode: 'US',
        };

        const result = validateObject(addressSpec, invalidAddress);
        expect(result.valid).toBeFalsy();
      });
    });

    describe('phoneSpec', () => {
      test('should validate a valid phone number without extension', () => {
        const validPhone: PhoneNumber = {
          number: '123-456-7890',
        };

        const result = validateObject(phoneSpec, validPhone);
        expect(result.valid).toBe(true);
      });

      test('should validate a valid phone number with extension', () => {
        const validPhone: PhoneNumber = {
          number: '123-456-7890',
          extension: '1234',
        };

        const result = validateObject(phoneSpec, validPhone);
        expect(result.valid).toBe(true);
      });

      test('should validate phone with country code', () => {
        const validPhone: PhoneNumber = {
          number: '1-123-456-7890',
        };

        const result = validateObject(phoneSpec, validPhone);
        expect(result.valid).toBe(true);
      });

      test('should reject invalid phone number format', () => {
        const invalidPhone: PhoneNumber = {
          number: '12345',
        };

        const result = validateObject(phoneSpec, invalidPhone);
        expect(result.valid).toBeFalsy();
      });

      test('should reject extension exceeding max length', () => {
        const invalidPhone: PhoneNumber = {
          number: '123-456-7890',
          extension: '1234567',
        };

        const result = validateObject(phoneSpec, invalidPhone);
        expect(result.valid).toBeFalsy();
      });
    });

    describe('contactInformationSpec', () => {
      test('should validate complete contact information', () => {
        const validContact: ContactInformation = {
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
          email: 'test@example.com',
          website: 'https://example.com',
          companyName: 'Test Company',
        };

        const result = validateObject(contactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate contact with only required address', () => {
        const validContact: ContactInformation = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
        };

        const result = validateObject(contactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate contact with website without protocol', () => {
        const validContact: ContactInformation = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          website: 'example.com',
        };

        const result = validateObject(contactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should reject contact with invalid email', () => {
        const invalidContact: ContactInformation = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          email: 'invalid-email',
        };

        const result = validateObject(contactInformationSpec, invalidContact);
        expect(result.valid).toBeFalsy();
      });

      test('should reject contact with website exceeding max length', () => {
        const invalidContact: ContactInformation = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          website: 'https://example.com/' + 'a'.repeat(250),
        };

        const result = validateObject(contactInformationSpec, invalidContact);
        expect(result.valid).toBeFalsy();
      });

      describe('company name', () => {
        test('should validate contact with company name containing alphanumeric and special characters', () => {
          const validContact: ContactInformation = {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '12345',
              countryCode: 'US',
            },
            companyName: "ABC Corp. & Co., Inc. - 123's Best!",
          };

          const result = validateObject(contactInformationSpec, validContact);
          expect(result.valid).toBe(true);
        });

        test('should reject contact with company name exceeding max length', () => {
          const invalidContact: ContactInformation = {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '12345',
              countryCode: 'US',
            },
            companyName: 'A'.repeat(51),
          };

          const result = validateObject(contactInformationSpec, invalidContact);
          expect(result.valid).toBeFalsy();
        });
      });
    });

    describe('internalContactInformationSpec', () => {
      test('should validate complete internal contact information', () => {
        const validContact: ContactInformation = {
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
          email: 'internal@example.com',
        };

        const result = validateObject(internalContactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate internal contact with null address', () => {
        const validContact: Partial<ContactInformation> = {
          address: null as unknown as Address,
          phone: {
            number: '123-456-7890',
          },
          email: 'internal@example.com',
        };

        const result = validateObject(internalContactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate internal contact with null phone', () => {
        const validContact: Partial<ContactInformation> = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          phone: null as unknown as PhoneNumber,
          email: 'internal@example.com',
        };

        const result = validateObject(internalContactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate internal contact with null email', () => {
        const validContact: Partial<ContactInformation> = {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          email: null as unknown as string,
        };

        const result = validateObject(internalContactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should validate empty internal contact', () => {
        const validContact: Partial<ContactInformation> = {};

        const result = validateObject(internalContactInformationSpec, validContact);
        expect(result.valid).toBe(true);
      });

      test('should reject internal contact with invalid email when provided', () => {
        const invalidContact: Partial<ContactInformation> = {
          email: 'invalid-email',
        };

        const result = validateObject(internalContactInformationSpec, invalidContact);
        expect(result.valid).toBeFalsy();
      });
    });

    describe('assistantSpec', () => {
      test('should validate complete assistant information', () => {
        const validAssistant: TrusteeAssistant = {
          name: 'John Doe',
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
            email: 'assistant@example.com',
          },
        };

        const result = validateObject(assistantSpec, validAssistant);
        expect(result.valid).toBe(true);
      });

      test('should validate assistant with minimal contact information', () => {
        const validAssistant: TrusteeAssistant = {
          name: 'Jane Smith',
          contact: {
            address: {
              address1: '456 Oak Ave',
              city: 'Boston',
              state: 'MA',
              zipCode: '02101',
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(assistantSpec, validAssistant);
        expect(result.valid).toBe(true);
      });

      test('should reject assistant with empty name', () => {
        const invalidAssistant: TrusteeAssistant = {
          name: '',
          contact: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '12345',
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(assistantSpec, invalidAssistant);
        expect(result.valid).toBeFalsy();
      });

      test('should reject assistant with invalid contact information', () => {
        const invalidAssistant: TrusteeAssistant = {
          name: 'John Doe',
          contact: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '1234', // Invalid zip code
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(assistantSpec, invalidAssistant);
        expect(result.valid).toBeFalsy();
      });
    });

    describe('trusteeSpec', () => {
      test('should validate complete trustee information', () => {
        const validTrustee: TrusteeInput = {
          name: 'Smith Trustee Services',
          public: {
            address: {
              address1: '789 Business Blvd',
              city: 'Chicago',
              state: 'IL',
              zipCode: '60601',
              countryCode: 'US',
            },
            phone: {
              number: '312-555-1234',
              extension: '100',
            },
            email: 'info@smithtrustee.com',
            website: 'https://smithtrustee.com',
            companyName: 'Smith Trustee Services',
          },
          internal: {
            address: {
              address1: '789 Business Blvd',
              city: 'Chicago',
              state: 'IL',
              zipCode: '60601',
              countryCode: 'US',
            },
            email: 'internal@smithtrustee.com',
          },
          assistant: {
            name: 'Mary Johnson',
            contact: {
              address: {
                address1: '789 Business Blvd',
                city: 'Chicago',
                state: 'IL',
                zipCode: '60601',
                countryCode: 'US',
              },
              email: 'mary@smithtrustee.com',
            },
          },
          banks: ['Bank of America', 'Chase', 'Wells Fargo'],
          software: 'BestCase',
          zoomInfo: {
            link: 'https://zoom.us/j/123456789',
            phone: '312-555-5678',
            meetingId: '12345678901',
            passcode: 'secret123',
          },
        };

        const result = validateObject(trusteeSpec, validTrustee);
        expect(result.valid).toBe(true);
      });

      test('should validate trustee with only required fields', () => {
        const validTrustee: TrusteeInput = {
          name: 'Minimal Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(trusteeSpec, validTrustee);
        expect(result.valid).toBe(true);
      });

      test('should reject trustee with empty name', () => {
        const invalidTrustee: TrusteeInput = {
          name: '',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with invalid public contact', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Public Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '123', // Invalid zip code
              countryCode: 'US',
            },
          },
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with invalid internal contact', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Internal Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          internal: {
            email: 'not-an-email',
          },
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with invalid assistant', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Assistant Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          assistant: {
            name: '', // Invalid empty name
            contact: {
              address: {
                address1: '123 Main St',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                countryCode: 'US',
              },
            },
          },
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with bank name exceeding max length', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Banks Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          banks: ['A'.repeat(101)], // Exceeds max length of 100
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with software exceeding max length', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Software Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          software: 'A'.repeat(101), // Exceeds max length of 100
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should reject trustee with invalid zoomInfo', () => {
        const invalidTrustee: TrusteeInput = {
          name: 'Invalid Zoom Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          zoomInfo: {
            link: 'not-a-url',
            phone: '123-456-7890',
            meetingId: '12345678901',
            passcode: 'secret',
          },
        };

        const result = validateObject(trusteeSpec, invalidTrustee);
        expect(result.valid).toBeFalsy();
      });

      test('should validate trustee with null zoomInfo', () => {
        const validTrustee: TrusteeInput = {
          name: 'Null Zoom Trustee',
          public: {
            address: {
              address1: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              countryCode: 'US',
            },
          },
          zoomInfo: null,
        };

        const result = validateObject(trusteeSpec, validTrustee);
        expect(result.valid).toBe(true);
      });
    });
  });
});
