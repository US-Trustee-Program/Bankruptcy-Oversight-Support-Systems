import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseZoomCsvFile, processZoomCsvRow } from './import-zoom-csv';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

const MOCK_TRUSTEE = {
  id: 'doc-123',
  trusteeId: 'trustee-456',
  name: 'John Doe',
  public: {
    address: { address1: '', city: '', state: 'NY', zipCode: '', countryCode: 'US' as const },
  },
};

const SAMPLE_TSV = [
  'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
  'NE\tNew York, NY\tJohn Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789',
  'SE\tAtlanta, GA\tJane Smith\tjane.smith@example.com\t987654321\txyz789\t098-765-4321\thttps://zoom.us/j/987654321',
].join('\n');

describe('import-zoom-csv', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseZoomCsvFile', () => {
    test('should parse valid rows from TSV content', () => {
      const rows = parseZoomCsvFile(SAMPLE_TSV);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        fullName: 'John Doe',
        accountEmail: 'john.doe@example.com',
        meetingId: '123456789',
        passcode: 'abc123',
        phone: '123-456-7890',
        link: 'https://zoom.us/j/123456789',
      });
      expect(rows[1]).toEqual({
        fullName: 'Jane Smith',
        accountEmail: 'jane.smith@example.com',
        meetingId: '987654321',
        passcode: 'xyz789',
        phone: '098-765-4321',
        link: 'https://zoom.us/j/987654321',
      });
    });

    test('should skip header row', () => {
      const rows = parseZoomCsvFile(SAMPLE_TSV);
      expect(rows.every((r) => r.fullName !== 'Trustee First and Last Name')).toBe(true);
    });

    test('should skip empty lines', () => {
      const contentWithEmptyLine = SAMPLE_TSV + '\n\n';
      const rows = parseZoomCsvFile(contentWithEmptyLine);
      expect(rows).toHaveLength(2);
    });

    test('should skip rows with fewer than 8 columns', () => {
      const contentWithShortRow = [
        'Region\tLocation\tName\tEmail\tMeetingId\tPasscode\tPhone',
        'NE\tNew York\tJohn Doe',
      ].join('\n');

      const rows = parseZoomCsvFile(contentWithShortRow);
      expect(rows).toHaveLength(0);
    });

    test('should return empty array for header-only content', () => {
      const headerOnly = 'Region\tLocation\tName\tEmail\tMeetingId\tPasscode\tPhone\tLink';
      const rows = parseZoomCsvFile(headerOnly);
      expect(rows).toHaveLength(0);
    });
  });

  describe('processZoomCsvRow', () => {
    const row = {
      fullName: 'John Doe',
      accountEmail: 'john.doe@example.com',
      meetingId: '123456789',
      passcode: 'abc123',
      phone: '123-456-7890',
      link: 'https://zoom.us/j/123456789',
    };

    test('should return "unmatched" when no trustees found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);

      const result = await processZoomCsvRow(context, row);

      expect(result).toBe('unmatched');
    });

    test('should return "ambiguous" when multiple trustees found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
        { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' },
      ]);

      const result = await processZoomCsvRow(context, row);

      expect(result).toBe('ambiguous');
    });

    test('should return "matched" and call updateTrustee with correct zoomInfo', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue({
        ...MOCK_TRUSTEE,
        zoomInfo: {
          link: 'https://zoom.us/j/1',
          phone: '123-456-7890',
          meetingId: '1',
          passcode: 'x',
        },
      });

      const result = await processZoomCsvRow(context, row);

      expect(result).toBe('matched');
      expect(updateSpy).toHaveBeenCalledWith(
        MOCK_TRUSTEE.trusteeId,
        expect.objectContaining({
          zoomInfo: {
            link: row.link,
            phone: row.phone,
            meetingId: row.meetingId,
            passcode: row.passcode,
            accountEmail: row.accountEmail,
          },
        }),
        expect.objectContaining({ id: 'SYSTEM' }),
      );
    });

    test('should return "error" when repo throws', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await processZoomCsvRow(context, row);

      expect(result).toBe('error');
    });
  });
});
