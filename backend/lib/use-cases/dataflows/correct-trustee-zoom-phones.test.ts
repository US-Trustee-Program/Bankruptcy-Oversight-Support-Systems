import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { PHONE_REGEX } from '@common/cams/regex';
import { Trustee, ZoomInfo } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
import { ObjectStorageGateway } from '../gateways.types';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { TrusteesUseCase } from '../trustees/trustees';
import CorrectTrusteeZoomPhones, { convertZoomPhone } from './correct-trustee-zoom-phones';

describe('CorrectTrusteeZoomPhones use case', () => {
  let context: ApplicationContext;
  let repo: MockMongoRepository;

  const zoomInfo = (phone: string | undefined): ZoomInfo =>
    ({
      link: 'https://us02web.zoom.us/j/1234567890',
      phone,
      meetingId: '1234567890',
      passcode: '0123456789',
      accountEmail: 'trustee@example.com',
    }) as ZoomInfo;

  const trusteeWithPhone = (trusteeId: string, phone: string | undefined): Trustee =>
    MockData.getTrustee({ trusteeId, name: `Trustee ${trusteeId}`, zoomInfo: zoomInfo(phone) });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    context = await createMockApplicationContext();
    repo = new MockMongoRepository();
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(repo);
  });

  describe('runCorrectionPass', () => {
    const tooManyRequests = () => new TooManyRequestsError('TEST', { message: 'throttled' });
    const noBudgetPressure = { baseDelayMs: 1, safeThresholdMs: 60_000 };

    test('should convert, skip, and flag phones, ignoring trustees without zoomInfo', async () => {
      const setZoomInfo = vi.spyOn(repo, 'setZoomInfo').mockResolvedValue(undefined);
      const updateTrustee = vi.spyOn(TrusteesUseCase.prototype, 'updateTrustee');
      const createTrusteeHistory = vi
        .spyOn(repo, 'createTrusteeHistory')
        .mockResolvedValue(undefined);
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '(555) 010-0123'),
        trusteeWithPhone('trustee-002', '555-010-0123'),
        trusteeWithPhone('trustee-003', '214-45'),
        trusteeWithPhone('trustee-004', undefined),
        MockData.getTrustee({ trusteeId: 'trustee-005' }),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 0 });

      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 1, alreadyValid: 1, flagged: 2, failed: 0 },
          results: [
            { trusteeId: 'trustee-001', outcome: 'converted', newValue: '555-010-0123' },
            { trusteeId: 'trustee-002', outcome: 'alreadyValid' },
            {
              trusteeId: 'trustee-003',
              outcome: 'flagged',
              reason: 'Zoom phone has 5 digits.',
              trusteeName: 'Trustee trustee-003',
              storedPhone: '214-45',
            },
            {
              trusteeId: 'trustee-004',
              outcome: 'flagged',
              reason: 'Zoom phone is empty or missing.',
              trusteeName: 'Trustee trustee-004',
              storedPhone: undefined,
            },
          ],
        },
      });
      expect(setZoomInfo).toHaveBeenCalledTimes(1);
      expect(setZoomInfo).toHaveBeenCalledWith('trustee-001', {
        ...zoomInfo('(555) 010-0123'),
        phone: '555-010-0123',
      });
      expect(updateTrustee).not.toHaveBeenCalled();
      expect(createTrusteeHistory).not.toHaveBeenCalled();
    });

    test('should record a failed write, log only its message, and continue with the remaining trustees', async () => {
      const logError = vi.spyOn(context.logger, 'error');
      const setZoomInfo = vi
        .spyOn(repo, 'setZoomInfo')
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce(undefined);
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '(555) 010-0123'),
        trusteeWithPhone('trustee-002', '(555) 123-4567'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 0 });

      expect(setZoomInfo).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        'CORRECT-TRUSTEE-ZOOM-PHONES-USE-CASE',
        'Failed to write the corrected Zoom phone for trustee trustee-001: Update failed',
      );
      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 1, alreadyValid: 0, flagged: 0, failed: 1 },
          results: [
            { trusteeId: 'trustee-001', outcome: 'failed', newValue: '555-010-0123' },
            { trusteeId: 'trustee-002', outcome: 'converted', newValue: '555-123-4567' },
          ],
        },
      });
    });

    test('should log the text of a write failure that is not an Error', async () => {
      const logError = vi.spyOn(context.logger, 'error');
      vi.spyOn(repo, 'setZoomInfo').mockRejectedValueOnce('plain string');
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '(555) 010-0123'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 0 });

      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 0, alreadyValid: 0, flagged: 0, failed: 1 },
          results: [{ trusteeId: 'trustee-001', outcome: 'failed', newValue: '555-010-0123' }],
        },
      });
      expect(logError).toHaveBeenCalledWith(
        'CORRECT-TRUSTEE-ZOOM-PHONES-USE-CASE',
        'Failed to write the corrected Zoom phone for trustee trustee-001: plain string',
      );
    });

    test('should return empty results and zero counts when there are no trustees', async () => {
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 0 });

      expect(result.data).toEqual({
        kind: 'complete',
        summary: { results: [], counts: { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 } },
      });
    });

    test('should return an error when trustees cannot be read for a reason other than throttling', async () => {
      vi.spyOn(repo, 'listTrustees').mockRejectedValue(new Error('Database error'));

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 0 });

      expect(result.error?.message).toEqual('Failed to correct trustee Zoom phones.');
      expect(result.data).toBeUndefined();
    });

    test('should back off and retry a throttled write instead of recording a failure', async () => {
      const setZoomInfo = vi
        .spyOn(repo, 'setZoomInfo')
        .mockRejectedValueOnce(tooManyRequests())
        .mockResolvedValue(undefined);
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '(555) 010-0123'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(
        context,
        { converted: 0 },
        noBudgetPressure,
      );

      expect(setZoomInfo).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 1, alreadyValid: 0, flagged: 0, failed: 0 },
          results: [{ trusteeId: 'trustee-001', outcome: 'converted', newValue: '555-010-0123' }],
        },
      });
    });

    test('should back off and retry a throttled read', async () => {
      const listTrustees = vi
        .spyOn(repo, 'listTrustees')
        .mockRejectedValueOnce(tooManyRequests())
        .mockResolvedValue([]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(
        context,
        { converted: 0 },
        noBudgetPressure,
      );

      expect(listTrustees).toHaveBeenCalledTimes(2);
      expect(result.data?.kind).toEqual('complete');
    });

    test('should escape with the trustees converted so far when a throttled write cannot back off within the budget', async () => {
      vi.useFakeTimers();
      vi.spyOn(repo, 'setZoomInfo')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(tooManyRequests());
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '(555) 010-0123'),
        trusteeWithPhone('trustee-002', '(555) 123-4567'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(
        context,
        { converted: 5 },
        { baseDelayMs: 1000, safeThresholdMs: 1500 },
      );

      expect(result.data).toEqual({
        kind: 'escape',
        state: { converted: 6 },
        backoffSeconds: 2,
      });
    });

    test('should escape without reading when the invocation budget is already spent', async () => {
      const listTrustees = vi.spyOn(repo, 'listTrustees');

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(
        context,
        { converted: 5 },
        { safeThresholdMs: 0 },
      );

      expect(listTrustees).not.toHaveBeenCalled();
      expect(result.data).toEqual({ kind: 'escape', state: { converted: 5 }, backoffSeconds: 0 });
    });

    test('should escape without writing when a throttled read cannot back off within the budget', async () => {
      vi.useFakeTimers();
      const setZoomInfo = vi.spyOn(repo, 'setZoomInfo');
      vi.spyOn(repo, 'listTrustees').mockRejectedValue(tooManyRequests());

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(
        context,
        { converted: 5 },
        { baseDelayMs: 1000, safeThresholdMs: 1500 },
      );

      expect(setZoomInfo).not.toHaveBeenCalled();
      expect(result.data).toEqual({
        kind: 'escape',
        state: { converted: 5 },
        backoffSeconds: 2,
      });
    });

    test('should count trustees converted before a continuation as converted, not already valid', async () => {
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '555-010-0123'),
        trusteeWithPhone('trustee-002', '555-123-4567'),
        trusteeWithPhone('trustee-003', '214-45'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 2 });

      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 2, alreadyValid: 0, flagged: 1, failed: 0 },
          results: [
            { trusteeId: 'trustee-001', outcome: 'alreadyValid' },
            { trusteeId: 'trustee-002', outcome: 'alreadyValid' },
            {
              trusteeId: 'trustee-003',
              outcome: 'flagged',
              reason: 'Zoom phone has 5 digits.',
              trusteeName: 'Trustee trustee-003',
              storedPhone: '214-45',
            },
          ],
        },
      });
    });
  });

  describe('runCorrectionPass continuation counts', () => {
    test('should not report more earlier conversions than there are already valid trustees', async () => {
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([
        trusteeWithPhone('trustee-001', '555-010-0123'),
      ]);

      const result = await CorrectTrusteeZoomPhones.runCorrectionPass(context, { converted: 5 });

      expect(result.data).toEqual({
        kind: 'complete',
        summary: {
          counts: { converted: 1, alreadyValid: 0, flagged: 0, failed: 0 },
          results: [{ trusteeId: 'trustee-001', outcome: 'alreadyValid' }],
        },
      });
    });
  });

  describe('writeFlaggedReport', () => {
    const HEADER = 'trusteeId,trusteeName,storedPhone,reason';
    let writeObject: Mock<ObjectStorageGateway['writeObject']>;

    const flagged = (
      trusteeId: string,
      trusteeName: string,
      storedPhone: string | undefined,
      reason = 'Zoom phone has 5 digits.',
    ) => ({ trusteeId, outcome: 'flagged' as const, reason, trusteeName, storedPhone });

    beforeEach(() => {
      writeObject = vi.fn<ObjectStorageGateway['writeObject']>().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue({
        readObject: vi.fn().mockResolvedValue(null),
        writeObject,
      });
      vi.unstubAllEnvs();
      vi.stubEnv('CAMS_OBJECT_CONTAINER', undefined);
    });

    test('should write a CSV of only the flagged trustees to the migration container', async () => {
      const location = await CorrectTrusteeZoomPhones.writeFlaggedReport(context, [
        { trusteeId: 'trustee-001', outcome: 'converted', newValue: '555-010-0123' },
        { trusteeId: 'trustee-002', outcome: 'alreadyValid' },
        flagged('trustee-003', 'Pat Poe', '214-45'),
        flagged('trustee-004', 'Sam Moe', undefined, 'Zoom phone is empty or missing.'),
        { trusteeId: 'trustee-005', outcome: 'failed', newValue: '555-123-4567' },
      ]);

      expect(writeObject).toHaveBeenCalledWith(
        'migration-files',
        'correct-trustee-zoom-phones-flagged.csv',
        [
          HEADER,
          'trustee-003,Pat Poe,214-45,Zoom phone has 5 digits.',
          'trustee-004,Sam Moe,,Zoom phone is empty or missing.',
        ].join('\n'),
      );
      expect(location).toEqual('migration-files/correct-trustee-zoom-phones-flagged.csv');
    });

    test('should write a header-only file when nothing is flagged so a stale report is replaced', async () => {
      await CorrectTrusteeZoomPhones.writeFlaggedReport(context, [
        { trusteeId: 'trustee-001', outcome: 'alreadyValid' },
      ]);

      expect(writeObject).toHaveBeenCalledWith(
        'migration-files',
        'correct-trustee-zoom-phones-flagged.csv',
        HEADER,
      );
    });

    test('should use the configured object container', async () => {
      vi.stubEnv('CAMS_OBJECT_CONTAINER', 'custom-container');

      await CorrectTrusteeZoomPhones.writeFlaggedReport(context, []);

      expect(writeObject).toHaveBeenCalledWith(
        'custom-container',
        'correct-trustee-zoom-phones-flagged.csv',
        HEADER,
      );
    });

    test('should quote values containing commas, quotes, or line breaks', async () => {
      await CorrectTrusteeZoomPhones.writeFlaggedReport(context, [
        flagged('trustee-001', 'Poe, Pat "PJ"', '555-010-0123,\n555'),
      ]);

      const row = writeObject.mock.calls[0][2].slice(HEADER.length + 1);
      expect(row).toEqual(
        'trustee-001,"Poe, Pat ""PJ""","555-010-0123,\n555",Zoom phone has 5 digits.',
      );
    });

    test.each([
      ['=SUM(A1)', "'=SUM(A1)"],
      ['+2 (555) 010-0123', "'+2 (555) 010-0123"],
      ['-5', "'-5"],
      ['@cmd', "'@cmd"],
      ['\tfoo', "'\tfoo"],
      ['\rfoo', '"\'\rfoo"'],
      ['=1,2', '"\'=1,2"'],
    ])(
      'should neutralize the stored phone %j so a spreadsheet does not read it as a formula',
      async (storedPhone, expectedCell) => {
        await CorrectTrusteeZoomPhones.writeFlaggedReport(context, [
          flagged('trustee-001', 'Pat Poe', storedPhone),
        ]);

        const row = writeObject.mock.calls[0][2].slice(HEADER.length + 1);
        expect(row).toEqual(`trustee-001,Pat Poe,${expectedCell},Zoom phone has 5 digits.`);
      },
    );

    test('should neutralize the trustee name and the reason as well as the stored phone', async () => {
      await CorrectTrusteeZoomPhones.writeFlaggedReport(context, [
        flagged('trustee-001', '=cmd', '214-45', '@reason'),
      ]);

      const row = writeObject.mock.calls[0][2].slice(HEADER.length + 1);
      expect(row).toEqual("trustee-001,'=cmd,214-45,'@reason");
    });

    test('should reject when the report cannot be written', async () => {
      writeObject.mockRejectedValue(new Error('Storage unavailable'));

      await expect(CorrectTrusteeZoomPhones.writeFlaggedReport(context, [])).rejects.toThrow(
        'Storage unavailable',
      );
    });
  });

  describe('convertZoomPhone', () => {
    test.each([
      ['555-010-0123'],
      ['1-555-010-0123'],
      ['555-010-0123 x123'],
      ['555-010-0123 ext. 55'],
    ])('should treat "%s" as already valid', (stored) => {
      expect(convertZoomPhone(stored)).toEqual({ outcome: 'alreadyValid' });
    });

    test.each([
      ['(555) 010-0123', '555-010-0123'],
      ['(555)010-0123', '555-010-0123'],
      ['(555) 010-0123 x123', '555-010-0123 x123'],
      ['555.010.0123', '555-010-0123'],
      ['5550100123', '555-010-0123'],
      ['(555) 010-0123 ext. 55', '555-010-0123 x55'],
      ['(555) 010-0123 X123', '555-010-0123 x123'],
      ['(555) 010-0123 EXT. 55', '555-010-0123 x55'],
      ['(555) 010-0123 extension 55', '555-010-0123 x55'],
      ['(555) 010-0123 extension: 55', '555-010-0123 x55'],
      ['(555) 010-0123 extension. 55', '555-010-0123 x55'],
      ['1 (555) 010-0123', '1-555-010-0123'],
      ['+1 (555) 010-0123', '1-555-010-0123'],
      [' 555-010-0123 ', '555-010-0123'],
    ])('should convert "%s" to "%s"', (stored, expected) => {
      const result = convertZoomPhone(stored);

      expect(result).toEqual({ outcome: 'converted', newValue: expected });
      expect(expected).toMatch(PHONE_REGEX);
      expect(convertZoomPhone(expected)).toEqual({ outcome: 'alreadyValid' });
    });

    const EMPTY = 'Zoom phone is empty or missing.';
    const UNEXPECTED = 'Zoom phone contains unexpected characters.';
    const BAD_FORMAT = 'Converted Zoom phone does not match the phone format.';

    test.each([
      ['214-45', 'Zoom phone has 5 digits.'],
      ['555-010-012', 'Zoom phone has 9 digits.'],
      ['2-555-010-0123', 'Zoom phone has 11 digits.'],
      ['555-010-01239', 'Zoom phone has 11 digits.'],
      ['+2 (555) 010-0123', 'Zoom phone has 11 digits.'],
      ['CALL-ME-NOW', UNEXPECTED],
      ['555+010-0123', UNEXPECTED],
      ['(555) 010-0123 x1234567', BAD_FORMAT],
      ['', EMPTY],
      ['   ', EMPTY],
      [undefined, EMPTY],
    ])('should flag %j for review: %s', (stored, reason) => {
      expect(convertZoomPhone(stored)).toEqual({ outcome: 'flagged', reason });
    });
  });
});
