import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseZoomTsvFile, processZoomTsvRow, importZoomCsv } from './import-zoom-csv';
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
    email: 'john.doe@example.com',
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

  describe('parseZoomTsvFile', () => {
    test('should parse valid rows from TSV content', () => {
      const rows = parseZoomTsvFile(SAMPLE_TSV);

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
      const rows = parseZoomTsvFile(contentWithEmptyLine);
      expect(rows).toHaveLength(2);
    });

    test('should skip rows with fewer than 8 columns', () => {
      const contentWithShortRow = [
        'Region\tLocation\tName\tEmail\tMeetingId\tPasscode\tPhone',
        'NE\tNew York\tJohn Doe',
      ].join('\n');

      const rows = parseZoomTsvFile(contentWithShortRow);
      expect(rows).toHaveLength(0);
    });

    test('should return empty array for header-only content', () => {
      const headerOnly = 'Region\tLocation\tName\tEmail\tMeetingId\tPasscode\tPhone\tLink';
      const rows = parseZoomTsvFile(headerOnly);
      expect(rows).toHaveLength(0);
    });

    test('should normalize empty accountEmail column to undefined', () => {
      const contentWithBlankEmail = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\t\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789',
      ].join('\n');

      const rows = parseZoomTsvFile(contentWithBlankEmail);

      expect(rows).toHaveLength(1);
      expect(rows[0].accountEmail).toBeUndefined();
    });
  });

  describe('processZoomTsvRow', () => {
    const row = {
      fullName: 'John Doe',
      accountEmail: 'john.doe@example.com',
      meetingId: '123456789',
      passcode: 'abc123',
      phone: '123-456-7890',
      link: 'https://zoom.us/j/123456789',
    };

    test('should return "unmatched" when no trustees found by any strategy', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);

      const result = await processZoomTsvRow(context, row);

      expect(result.outcome).toBe('unmatched');
      expect(result.matchStrategy).toBeUndefined();
      expect(result.matchedTrusteeId).toBeUndefined();
    });

    test('should return "ambiguous" when multiple trustees found with same email', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        MOCK_TRUSTEE,
        { ...MOCK_TRUSTEE, trusteeId: 'trustee-789', name: 'John A. Doe' },
      ]);

      const result = await processZoomTsvRow(context, row);

      expect(result.outcome).toBe('ambiguous');
      expect(result.matchStrategy).toBeUndefined();
    });

    test('should return "matched" and update trustee when matched by email', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([MOCK_TRUSTEE]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomTsvRow(context, row);

      expect(result.outcome).toBe('matched');
      expect(result.matchStrategy).toBe('email');
      expect(result.matchedTrusteeId).toBe('trustee-456');
      expect(result.matchedTrusteeName).toBe('John Doe');
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    test('should return "matched" and update trustee when matched by exact name', async () => {
      const rowWithoutEmail = { ...row, accountEmail: undefined };
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomTsvRow(context, rowWithoutEmail);

      expect(result.outcome).toBe('matched');
      expect(result.matchStrategy).toBe('exact-name');
      expect(result.matchedTrusteeId).toBe('trustee-456');
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    test('should return "matched" and update trustee when matched by fuzzy name', async () => {
      const rowWithTypo = { ...row, fullName: 'Jon Doe', accountEmail: undefined };
      const trusteeWithSimilarName = { ...MOCK_TRUSTEE, name: 'John Doe' };
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([
        trusteeWithSimilarName,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(trusteeWithSimilarName);

      const result = await processZoomTsvRow(context, rowWithTypo);

      expect(result.outcome).toBe('matched');
      expect(result.matchStrategy).toBe('fuzzy-name');
      expect(result.matchedTrusteeId).toBe('trustee-456');
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    test('should set accountEmail to undefined on trustee when row has no accountEmail', async () => {
      const rowWithoutEmail = { ...row, accountEmail: undefined };
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomTsvRow(context, rowWithoutEmail);

      expect(result.outcome).toBe('matched');
      expect(updateSpy).toHaveBeenCalledWith(
        MOCK_TRUSTEE.trusteeId,
        expect.objectContaining({ zoomInfo: expect.objectContaining({ accountEmail: undefined }) }),
        { id: 'SYSTEM', name: 'ATS Migration' },
      );
    });

    test('should return "error" when repo throws', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await processZoomTsvRow(context, row);

      expect(result.outcome).toBe('error');
      expect(result.matchStrategy).toBeUndefined();
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
        'zoom-import-report.tsv',
        'fullName\taccountEmail\tmeetingId\tpasscode\tphone\tlink\toutcome\tmatchStrategy\tmatchedTrusteeId\tmatchedTrusteeName',
      );
    });

    test('should return a summary aggregating all row outcomes', async () => {
      const mixedTsv = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\tjohn.doe@example.com\t111\tabc\t111-111-1111\thttps://zoom.us/j/1',
        'SE\tAtlanta, GA\tJane Smith\t\t222\tdef\t222-222-2222\thttps://zoom.us/j/2',
        'MW\tChicago, IL\tBob Jones\tbob@example.com\t333\tghi\t333-333-3333\thttps://zoom.us/j/3',
        'SW\tDallas, TX\tAmy Lee\tamy@example.com\t444\tjkl\t444-444-4444\thttps://zoom.us/j/4',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(mixedTsv);
      const bobTrustee1 = {
        ...MOCK_TRUSTEE,
        trusteeId: 'trustee-bob-1',
        public: { ...MOCK_TRUSTEE.public, email: 'bob@example.com' },
        name: 'Bob Jones',
      };
      const bobTrustee2 = {
        ...MOCK_TRUSTEE,
        trusteeId: 'trustee-bob-2',
        public: { ...MOCK_TRUSTEE.public, email: 'bob@example.com' },
        name: 'Robert Jones',
      };

      vi.spyOn(MockMongoRepository.prototype, 'listTrustees')
        .mockResolvedValueOnce([MOCK_TRUSTEE]) // John Doe - matched by email
        .mockResolvedValueOnce([bobTrustee1, bobTrustee2]) // Bob Jones - ambiguous (2 trustees same email)
        .mockRejectedValueOnce(new Error('DB error')); // Amy Lee - error during listTrustees

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValueOnce([
        MOCK_TRUSTEE,
        { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' },
      ]); // Jane Smith - ambiguous by exact name

      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      expect(result).toEqual({ total: 4, matched: 1, unmatched: 0, ambiguous: 2, errors: 1 });
    });

    test('should write TSV report with outcome for each row', async () => {
      const tsv = [
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
        'NE\tNew York, NY\tJohn Doe\tjohn.doe@example.com\t111\tabc\t111-111-1111\thttps://zoom.us/j/1',
        'SE\tAtlanta, GA\tJane Smith\t\t222\tdef\t222-222-2222\thttps://zoom.us/j/2',
        'MW\tChicago, IL\tBob Jones\tbob@example.com\t333\tghi\t333-333-3333\thttps://zoom.us/j/3',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(tsv);
      vi.spyOn(MockMongoRepository.prototype, 'listTrustees')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('DB error'));
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([MOCK_TRUSTEE, { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' }]);

      await importZoomCsv(context);

      const reportContent = vi.mocked(mockObjectStorage.writeObject).mock.calls[0][2];
      const lines = reportContent.split('\n');
      expect(lines[0]).toBe(
        'fullName\taccountEmail\tmeetingId\tpasscode\tphone\tlink\toutcome\tmatchStrategy\tmatchedTrusteeId\tmatchedTrusteeName',
      );
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('unmatched');
      expect(lines[2]).toContain('Jane Smith');
      expect(lines[2]).toContain('ambiguous');
      expect(lines[3]).toContain('Bob Jones');
      expect(lines[3]).toContain('error');
    });

    test('should write report file to zoom-import-report.tsv', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(
        'Region\tLocation (City, State)\tTrustee First and Last Name\tZoom Account Email Address\tZoom Meeting ID\tZoom Passcode\tZoom Dedicated Phone Number\tZoom Meeting Link',
      );

      await importZoomCsv(context);

      expect(mockObjectStorage.writeObject).toHaveBeenCalledWith(
        expect.any(String),
        'zoom-import-report.tsv',
        expect.any(String),
      );
    });
  });
});
