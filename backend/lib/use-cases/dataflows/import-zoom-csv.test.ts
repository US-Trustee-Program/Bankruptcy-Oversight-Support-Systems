import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseZoomMatchedTsvFile, processZoomMatchedRow, importZoomCsv } from './import-zoom-csv';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockNotificationGateway } from '../../adapters/gateways/notifications/mock-notification.gateway';
import factory from '../../factory';
import { ObjectStorageGateway } from '../gateways.types';
import MockData from '@common/cams/test-utilities/mock-data';

const MOCK_TRUSTEE = MockData.getTrustee({
  trusteeId: 'trustee-456',
  name: 'John Doe',
  public: {
    address: { address1: '', city: '', state: 'NY', zipCode: '', countryCode: 'US' as const },
    email: 'john.doe@example.com',
  },
  legacy: {
    truIds: ['12345'],
  },
});

const SAMPLE_MATCHED_TSV = [
  'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
  'John Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789\tmatched\temail\t12345\tJohn Doe\t1\t100.0\tYES\tPA,V\t',
  'Jane Smith\tjane.smith@example.com\t987654321\txyz789\t098-765-4321\thttps://zoom.us/j/987654321\tmatched\tcomponent-name\t67890\tJane Smith\t1\t100.0\tYES\t1\t',
].join('\n');

describe('import-zoom-csv', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  describe('parseZoomMatchedTsvFile', () => {
    test('should parse valid rows from matching report TSV with zoom details', () => {
      const rows = parseZoomMatchedTsvFile(SAMPLE_MATCHED_TSV);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        zoomName: 'John Doe',
        zoomEmail: 'john.doe@example.com',
        meetingId: '123456789',
        passcode: 'abc123',
        phone: '123-456-7890',
        link: 'https://zoom.us/j/123456789',
        outcome: 'matched',
        strategy: 'email',
        atsTruIds: '12345',
        matchedNames: 'John Doe',
        matchCount: '1',
        similarity: '100.0',
        activeStatus: 'YES',
        statusCodes: 'PA,V',
        ambiguousCandidates: '',
      });
    });

    test('should skip empty lines', () => {
      const contentWithEmptyLine = SAMPLE_MATCHED_TSV + '\n\n';
      const rows = parseZoomMatchedTsvFile(contentWithEmptyLine);
      expect(rows).toHaveLength(2);
    });

    test('should return empty array for header-only content', () => {
      const headerOnly =
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates';
      const rows = parseZoomMatchedTsvFile(headerOnly);
      expect(rows).toHaveLength(0);
    });

    test('should throw error if required columns missing', () => {
      const missingColumns = 'Zoom Name\tZoom Email\tOutcome';
      expect(() => parseZoomMatchedTsvFile(missingColumns)).toThrow('Required columns missing');
    });

    test('should throw error if Link column missing', () => {
      const missingLink = 'Zoom Name\tZoom Email\tMeeting ID\tATS TRU_IDs';
      expect(() => parseZoomMatchedTsvFile(missingLink)).toThrow(
        'Required columns missing from zoom matching report: Zoom Name, ATS TRU_IDs, Meeting ID, Link',
      );
    });

    test('should handle multiple ATS TRU_IDs', () => {
      const multipleIds = [
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
        'John Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789\tmatched\temail\t12345,67890\tJohn Doe; John A. Doe\t2\t100.0\tYES; YES\tPA,V; 1\t',
      ].join('\n');

      const rows = parseZoomMatchedTsvFile(multipleIds);
      expect(rows).toHaveLength(1);
      expect(rows[0].atsTruIds).toBe('12345,67890');
      expect(rows[0].matchedNames).toBe('John Doe; John A. Doe');
    });
  });

  describe('processZoomMatchedRow', () => {
    const row = {
      zoomName: 'John Doe',
      zoomEmail: 'john.doe@example.com',
      meetingId: '123456789',
      passcode: 'abc123',
      phone: '123-456-7890',
      link: 'https://zoom.us/j/123456789',
      outcome: 'matched',
      strategy: 'email',
      atsTruIds: '12345',
      matchedNames: 'John Doe',
      matchCount: '1',
      similarity: '100.0',
      activeStatus: 'YES',
      statusCodes: 'PA,V',
      ambiguousCandidates: '',
    };

    test('should find trustee by TRU_ID and update with zoom info', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomMatchedRow(context, row);

      expect(result.outcome).toBe('matched');
      expect(result.matchStrategy).toBe('email');
      expect(result.matchedTrusteeId).toBe('trustee-456');
      expect(result.matchedTrusteeName).toBe('John Doe');
      expect(updateSpy).toHaveBeenCalledWith(
        'trustee-456',
        expect.objectContaining({
          zoomInfo: {
            meetingId: '123456789',
            passcode: 'abc123',
            phone: '123-456-7890',
            link: 'https://zoom.us/j/123456789',
            accountEmail: 'john.doe@example.com',
          },
        }),
        { id: 'SYSTEM', name: 'Zoom Info Import' },
      );
    });

    test('should fall back to name matching when TRU_ID not found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
        MOCK_TRUSTEE,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomMatchedRow(context, row);

      expect(result.outcome).toBe('matched');
      expect(updateSpy).toHaveBeenCalledOnce();
    });

    test('should return unmatched when TRU_ID and fallback both fail', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByPhoneticTokens').mockResolvedValue(
        [],
      );

      const result = await processZoomMatchedRow(context, row);

      expect(result.outcome).toBe('unmatched');
      expect(result.matchedTrusteeId).toBeUndefined();
    });

    test('should return error when no TRU_IDs provided', async () => {
      const rowWithoutIds = { ...row, atsTruIds: '' };

      const result = await processZoomMatchedRow(context, rowWithoutIds);

      expect(result.outcome).toBe('error');
    });

    test('should return error when zoom details missing', async () => {
      const rowWithoutDetails = { ...row, meetingId: '', link: '' };

      const result = await processZoomMatchedRow(context, rowWithoutDetails);

      expect(result.outcome).toBe('error');
    });

    test('should mark as ambiguous when multiple TRU_IDs resolve to different trustees', async () => {
      const rowWithMultipleIds = { ...row, atsTruIds: '12345,67890' };
      const secondTrustee = { ...MOCK_TRUSTEE, trusteeId: 'trustee-789' };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId')
        .mockResolvedValueOnce(MOCK_TRUSTEE)
        .mockResolvedValueOnce(secondTrustee);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomMatchedRow(context, rowWithMultipleIds);

      expect(result.outcome).toBe('ambiguous');
      expect(result.matchedTrusteeId).toBeUndefined();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should return error when repo throws', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await processZoomMatchedRow(context, row);

      expect(result.outcome).toBe('error');
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

    test('should return empty result when no file exists', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(null);

      const result = await importZoomCsv(context);

      expect(result).toEqual({ total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 });
      expect(mockObjectStorage.writeObject).not.toHaveBeenCalled();
    });

    test('should process matched report and generate import report', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(SAMPLE_MATCHED_TSV);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId')
        .mockResolvedValueOnce(MOCK_TRUSTEE)
        .mockResolvedValueOnce({ ...MOCK_TRUSTEE, trusteeId: 'trustee-789', name: 'Jane Smith' });
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      expect(result.total).toBe(2);
      expect(result.matched).toBe(2);
      expect(mockObjectStorage.writeObject).toHaveBeenCalledWith(
        expect.any(String),
        'zoom-import-report.tsv',
        expect.any(String),
      );
    });

    test('should write report file to zoom-import-report.tsv', async () => {
      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(SAMPLE_MATCHED_TSV);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      await importZoomCsv(context);

      expect(mockObjectStorage.writeObject).toHaveBeenCalledWith(
        expect.any(String),
        'zoom-import-report.tsv',
        expect.stringContaining('zoomName\tzoomEmail\tatsTruIds'),
      );
    });

    test('should handle deduplicated TRU_IDs mapping to same trustee', async () => {
      const rowWithDeduplicatedIds = [
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
        'John Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789\tmatched\temail\t12345,67890\tJohn Doe; John Doe\t2\t100.0\tYES; YES\tPA,V; PA,V\t',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(rowWithDeduplicatedIds);
      // Both TRU_IDs map to the same CAMS trustee
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      expect(result.total).toBe(1);
      expect(result.matched).toBe(1);
      expect(result.ambiguous).toBe(0);
    });

    test('should handle reports without metrics mismatch', async () => {
      const warnSpy = vi.spyOn(context.logger, 'warn');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(SAMPLE_MATCHED_TSV);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      await importZoomCsv(context);

      // Verify no metrics mismatch warning when report is valid
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Mismatch between in-loop metrics'),
      );
    });

    test('should validate generated report has outcome column', async () => {
      // This validates that the generated report includes the outcome column
      // Note: parseZoomMatchedTsvFile validates input has required columns, so this tests the
      // countOutcomesFromReportLines validation of the GENERATED report format

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(SAMPLE_MATCHED_TSV);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      // Valid report should succeed
      expect(result.total).toBeGreaterThan(0);
    });

    test('should count all outcome types correctly', async () => {
      const mixedOutcomes = [
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
        'Match User\tmatch@example.com\t111\tabc\t111\thttps://zoom.us/j/111\tmatched\temail\t11111\tMatch User\t1\t100\tYES\tPA\t',
        'Unmatch User\tunmatch@example.com\t222\tdef\t222\thttps://zoom.us/j/222\tunmatched\tnone\t22222\t\t0\t\t\t\t',
        'Ambiguous User\tambig@example.com\t333\tghi\t333\thttps://zoom.us/j/333\tambiguous\tname\t33333,44444\tUser A; User B\t2\t100\tYES\tPA\t',
        'Error User\terror@example.com\t444\tjkl\t444\thttps://zoom.us/j/444\terror\tnone\t55555\t\t0\t\t\t\t',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(mixedOutcomes);

      // Setup mocks for each row
      const mockTrustee1 = { ...MOCK_TRUSTEE, trusteeId: 'trustee-1' };
      const mockTrustee2 = { ...MOCK_TRUSTEE, trusteeId: 'trustee-2' };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId')
        .mockResolvedValueOnce(mockTrustee1) // row 1: matched
        .mockResolvedValueOnce(null) // row 2: unmatched (no trustee found)
        .mockResolvedValueOnce(mockTrustee1) // row 3: ambiguous - first ID
        .mockResolvedValueOnce(mockTrustee2) // row 3: ambiguous - second ID (different trustee)
        .mockResolvedValueOnce(null); // row 4: error user - no trustee found

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByPhoneticTokens').mockResolvedValue(
        [],
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await importZoomCsv(context);

      expect(result.total).toBe(4);
      expect(result.matched).toBe(1); // Match User
      expect(result.unmatched).toBe(2); // Unmatch User + Error User (both fallback to unmatched)
      expect(result.ambiguous).toBe(1); // Ambiguous User
      expect(result.errors).toBe(0); // No actual errors (just unmatched)
    });

    test('should log debug for deduplicated TRU_IDs', async () => {
      const rowWithDeduplicatedIds = [
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
        'John Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789\tmatched\temail\t12345,67890\tJohn Doe; John Doe\t2\t100.0\tYES; YES\tPA,V; PA,V\t',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(rowWithDeduplicatedIds);
      // Both TRU_IDs map to the same CAMS trustee
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);
      const debugSpy = vi.spyOn(context.logger, 'debug');

      await importZoomCsv(context);

      expect(debugSpy).toHaveBeenCalledWith(
        'IMPORT-ZOOM-CSV',
        expect.stringContaining('mapped to already-found CAMS trustee'),
      );
    });

    test('should log info when some TRU_IDs not found but others succeed', async () => {
      const rowWithMixedIds = [
        'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
        'John Doe\tjohn.doe@example.com\t123456789\tabc123\t123-456-7890\thttps://zoom.us/j/123456789\tmatched\temail\t12345,99999\tJohn Doe\t1\t100.0\tYES\tPA,V\t',
      ].join('\n');

      vi.mocked(mockObjectStorage.readObject).mockResolvedValue(rowWithMixedIds);
      // First TRU_ID found, second not found
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId')
        .mockResolvedValueOnce(MOCK_TRUSTEE)
        .mockResolvedValueOnce(null);
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);
      const infoSpy = vi.spyOn(context.logger, 'info');

      await importZoomCsv(context);

      expect(infoSpy).toHaveBeenCalledWith(
        'IMPORT-ZOOM-CSV',
        expect.stringContaining('Some ATS TRU_IDs not found in CAMS'),
      );
    });
  });

  describe('notification suppression (CAMS-768 Slice 4)', () => {
    beforeEach(() => {
      context.featureFlags['trustee-change-notification-enabled'] = true;
      MockNotificationGateway.getInstance().clear();

      vi.spyOn(MockMongoRepository.prototype, 'findRecipientByKey').mockResolvedValue({
        key: 'category:zoom-341',
        recipientAddress: 'ustp-help@example.test',
        displayName: 'USTP Help',
      });
      vi.spyOn(MockMongoRepository.prototype, 'getDefaultRecipient').mockResolvedValue({
        key: 'default',
        recipientAddress: 'default-oversight@example.test',
        displayName: 'Default Oversight',
      });
    });

    afterEach(() => {
      MockNotificationGateway.getInstance().clear();
    });

    test('processZoomMatchedRow does not dispatch notifications when updating trustee zoom info', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByLegacyTruId').mockResolvedValue(
        MOCK_TRUSTEE,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateTrustee').mockResolvedValue(MOCK_TRUSTEE);

      const result = await processZoomMatchedRow(context, {
        zoomName: 'John Doe',
        zoomEmail: 'john.doe@example.com',
        meetingId: '123456789',
        passcode: 'abc123',
        phone: '123-456-7890',
        link: 'https://zoom.us/j/123456789',
        outcome: 'matched',
        strategy: 'email',
        atsTruIds: '12345',
        matchedNames: 'John Doe',
        matchCount: '1',
        similarity: '100.0',
        activeStatus: 'YES',
        statusCodes: 'PA,V',
        ambiguousCandidates: '',
      });

      expect(result.outcome).toBe('matched');
      expect(MockNotificationGateway.getInstance().getRecorded()).toHaveLength(0);
    });
  });
});
