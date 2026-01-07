import { describe, expect, test } from 'vitest';
import { composeCaseTitle } from './caseDetailHelper';
import MockData from '@common/cams/test-utilities/mock-data';

describe('caseDetailHelper', () => {
  describe('composeCaseTitle', () => {
    test('should return empty string when caseDetail is undefined', () => {
      const result = composeCaseTitle(undefined);
      expect(result).toBe('');
    });

    test('should return debtor name when there is no joint debtor', () => {
      const caseDetail = MockData.getCaseDetail({
        override: {
          debtor: {
            name: 'John Doe',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
        },
      });

      const result = composeCaseTitle(caseDetail);
      expect(result).toBe('John Doe');
    });

    test('should return combined debtor and joint debtor names when joint debtor exists', () => {
      const caseDetail = MockData.getCaseDetail({
        override: {
          debtor: {
            name: 'John Doe',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
          jointDebtor: {
            name: 'Jane Doe',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
        },
      });

      const result = composeCaseTitle(caseDetail);
      expect(result).toBe('John Doe & Jane Doe');
    });

    test('should return only debtor name when joint debtor exists but has no name', () => {
      const caseDetail = MockData.getCaseDetail({
        override: {
          debtor: {
            name: 'John Doe',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
          jointDebtor: {
            name: '',
            address1: '123 Main St',
            cityStateZipCountry: 'New York, NY 10001',
          },
        },
      });

      const result = composeCaseTitle(caseDetail);
      expect(result).toBe('John Doe');
    });
  });
});
