import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseZoomCsvFile, processZoomCsvRow, importZoomCsv } from './import-zoom-csv';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
import { ObjectStorageGateway } from '../gateways.types';

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
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
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

    test('should normalize empty accountEmail column to undefined', () => {
      const contentWithBlankEmail = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\t\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789',
      ].join('\n');

      const rows = parseZoomCsvFile(contentWithBlankEmail);

      expect(rows).toHaveLength(1);
      expect(rows[0].accountEmail).toBeUndefined();
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

    test('should return "matched" and update trustee with zoom info from row', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomCsvRow(context, row);

      expect(result).toBe('matched');
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    test('should set accountEmail to undefined on trustee when row has no accountEmail', async () => {
      const rowWithoutEmail = { ...row, accountEmail: undefined };
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomCsvRow(context, rowWithoutEmail);

      expect(result).toBe('matched');
      expect(updateSpy).toHaveBeenCalledWith(
        MOCK_TRUSTEE.trusteeId,
        expect.objectContaining({ zoomInfo: expect.objectContaining({ accountEmail: undefined }) }),
        { id: 'SYSTEM', name: 'ATS Migration' },
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

  describe('importZoomCsv', () => {
    let mockObjectStorage: ObjectStorageGateway;

    beforeEach(() => {
      mockObjectStorage = {
        readObject: vi.fn(),
        writeObject: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(mockObjectStorage);
    });

    test('should return empty result and skip report when no file exists', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(null);

      const result = await importZoomCsv(context);

      expect(result).toEqual({ total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 });
      expect(mockObjectStorage.writeObject).not.toHaveBeenCalled();
    });

    test('should write report with only headers when no data rows', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
      );

      const result = await importZoomCsv(context);

      expect(result).toEqual({ total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 });
      expect(mockObjectStorage.writeObject).toHaveBeenCalledWith(
        expect.any(String),
        'zoom-import-report.csv',
        '"fullName","accountEmail","meetingId","passcode","phone","link","outcome"',
      );
    });

    test('should return a summary aggregating all row outcomes', async () => {
      const mixedTsv = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\tjohn.doe@example.com\t111\tabc\t111-111-1111\thttps://zoom.us/j/1',
        'SE\tAtlanta, GA\tJane Smith\tjane.smith@example.com\t222\tdef\t222-222-2222\thttps://zoom.us/j/2',
        'MW\tChicago, IL\tBob Jones\tbob@example.com\t333\tghi\t333-333-3333\thttps://zoom.us/j/3',
        'SW\tDallas, TX\tAmy Lee\tamy@example.com\t444\tjkl\t444-444-4444\thttps://zoom.us/j/4',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(mixedTsv);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName')
        .mockResolvedValueOnce([MOCK_TRUSTEE])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([MOCK_TRUSTEE, { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' }])
        .mockRejectedValueOnce(new Error('DB error'));
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      expect(result).toEqual({ total: 4, matched: 1, unmatched: 1, ambiguous: 1, errors: 1 });
    });

    test('should write CSV report with outcome for each row', async () => {
      const tsv = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\tjohn.doe@example.com\t111\tabc\t111-111-1111\thttps://zoom.us/j/1',
        'SE\tAtlanta, GA\tJane Smith\t\t222\tdef\t222-222-2222\thttps://zoom.us/j/2',
        'MW\tChicago, IL\tBob Jones\tbob@example.com\t333\tghi\t333-333-3333\thttps://zoom.us/j/3',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(tsv);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([MOCK_TRUSTEE, { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' }])
        .mockRejectedValueOnce(new Error('DB error'));

      await importZoomCsv(context);

      const reportContent = vi.mocked(mockObjectStorage.writeObject).mock.calls[0][2];
      const lines = reportContent.split('\n');
      expect(lines[0]).toBe(
        '"fullName","accountEmail","meetingId","passcode","phone","link","outcome"',
      );
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('unmatched');
      expect(lines[2]).toContain('Jane Smith');
      expect(lines[2]).toContain('ambiguous');
      expect(lines[3]).toContain('Bob Jones');
      expect(lines[3]).toContain('error');
    });

    test('should quote and escape CSV fields containing commas or double-quotes', async () => {
      const tsv = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tDoe, John\t"tricky"@example.com\t111\tabc\t111-111-1111\thttps://zoom.us/j/1',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(tsv);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);

      await importZoomCsv(context);

      const reportContent = vi.mocked(mockObjectStorage.writeObject).mock.calls[0][2];
      const lines = reportContent.split('\n');
      expect(lines[1]).toContain('"Doe, John"');
      expect(lines[1]).toContain('"""tricky""@example.com"');
    });
  });
});
