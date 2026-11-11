import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PHONE_REGEX } from '@common/cams/regex';
import { Trustee, ZoomInfo } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
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
    context = await createMockApplicationContext();
    repo = new MockMongoRepository();
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(repo);
  });

  describe('getTrusteesWithZoomInfo', () => {
    test('should return only trustees that have zoomInfo', async () => {
      const withZoom = trusteeWithPhone('trustee-001', '(680) 214-4529');
      const withoutZoom = MockData.getTrustee({ trusteeId: 'trustee-002' });
      vi.spyOn(repo, 'listTrustees').mockResolvedValue([withZoom, withoutZoom]);

      const result = await CorrectTrusteeZoomPhones.getTrusteesWithZoomInfo(context);

      expect(result.data).toEqual([withZoom]);
    });

    test('should return an error when listTrustees fails', async () => {
      vi.spyOn(repo, 'listTrustees').mockRejectedValue(new Error('Database error'));

      const result = await CorrectTrusteeZoomPhones.getTrusteesWithZoomInfo(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('correctZoomPhones', () => {
    test('should convert, skip, and flag phones and report counts', async () => {
      const setZoomInfo = vi.spyOn(repo, 'setZoomInfo').mockResolvedValue(undefined);
      const updateTrustee = vi.spyOn(TrusteesUseCase.prototype, 'updateTrustee');
      const trustees = [
        trusteeWithPhone('trustee-001', '(680) 214-4529'),
        trusteeWithPhone('trustee-002', '680-214-4529'),
        trusteeWithPhone('trustee-003', '214-45'),
        trusteeWithPhone('trustee-004', undefined),
      ];

      const result = await CorrectTrusteeZoomPhones.correctZoomPhones(context, trustees);

      expect(result.data!.counts).toEqual({ converted: 1, alreadyValid: 1, flagged: 2, failed: 0 });
      expect(result.data!.results).toEqual([
        {
          trusteeId: 'trustee-001',
          trusteeName: 'Trustee trustee-001',
          storedValue: '(680) 214-4529',
          outcome: 'converted',
          newValue: '680-214-4529',
        },
        {
          trusteeId: 'trustee-002',
          trusteeName: 'Trustee trustee-002',
          storedValue: '680-214-4529',
          outcome: 'alreadyValid',
        },
        expect.objectContaining({
          trusteeId: 'trustee-003',
          storedValue: '214-45',
          outcome: 'flagged',
          reason: expect.any(String),
        }),
        expect.objectContaining({
          trusteeId: 'trustee-004',
          storedValue: undefined,
          outcome: 'flagged',
          reason: expect.any(String),
        }),
      ]);
      expect(setZoomInfo).toHaveBeenCalledTimes(1);
      expect(setZoomInfo).toHaveBeenCalledWith('trustee-001', {
        ...zoomInfo('(680) 214-4529'),
        phone: '680-214-4529',
      });
      expect(updateTrustee).not.toHaveBeenCalled();
    });

    test('should record a failed write and continue with the remaining trustees', async () => {
      const setZoomInfo = vi
        .spyOn(repo, 'setZoomInfo')
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce(undefined);
      const trustees = [
        trusteeWithPhone('trustee-001', '(680) 214-4529'),
        trusteeWithPhone('trustee-002', '(555) 123-4567'),
      ];

      const result = await CorrectTrusteeZoomPhones.correctZoomPhones(context, trustees);

      expect(setZoomInfo).toHaveBeenCalledTimes(2);
      expect(result.data!.counts).toEqual({ converted: 1, alreadyValid: 0, flagged: 0, failed: 1 });
      expect(result.data!.results[0]).toEqual(
        expect.objectContaining({
          trusteeId: 'trustee-001',
          outcome: 'failed',
          newValue: '680-214-4529',
          error: 'Update failed',
        }),
      );
      expect(result.data!.results[1].outcome).toBe('converted');
    });

    test('should return empty results and zero counts for no trustees', async () => {
      const result = await CorrectTrusteeZoomPhones.correctZoomPhones(context, []);

      expect(result.data).toEqual({
        results: [],
        counts: { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 },
      });
    });

    test('should return an error when the repository cannot be created', async () => {
      vi.spyOn(factory, 'getTrusteesRepository').mockImplementation(() => {
        throw new Error('No repository');
      });

      const result = await CorrectTrusteeZoomPhones.correctZoomPhones(context, [
        trusteeWithPhone('trustee-001', '(680) 214-4529'),
      ]);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('convertZoomPhone', () => {
    test.each([
      ['680-214-4529'],
      ['1-680-214-4529'],
      ['680-214-4529 x123'],
      ['680-214-4529 ext. 55'],
    ])('should treat "%s" as already valid', (stored) => {
      expect(convertZoomPhone(stored)).toEqual({ outcome: 'alreadyValid' });
    });

    test.each([
      ['(680) 214-4529', '680-214-4529'],
      ['(680)214-4529', '680-214-4529'],
      ['(680) 214-4529 x123', '680-214-4529 x123'],
      ['680.214.4529', '680-214-4529'],
      ['6802144529', '680-214-4529'],
      ['(680) 214-4529 ext. 55', '680-214-4529 x55'],
      ['(680) 214-4529 extension 55', '680-214-4529 x55'],
      ['1 (680) 214-4529', '1-680-214-4529'],
      ['+1 (680) 214-4529', '1-680-214-4529'],
      [' 680-214-4529 ', '680-214-4529'],
    ])('should convert "%s" to "%s"', (stored, expected) => {
      const result = convertZoomPhone(stored);

      expect(result).toEqual({ outcome: 'converted', newValue: expected });
      expect(expected).toMatch(PHONE_REGEX);
      expect(convertZoomPhone(expected)).toEqual({ outcome: 'alreadyValid' });
    });

    test.each([
      ['214-45'],
      ['680-214-452'],
      ['2-680-214-4529'],
      ['680-214-45299'],
      ['CALL-ME-NOW'],
      ['(680) 214-4529 x1234567'],
      ['+2 (680) 214-4529'],
      [''],
      ['   '],
      [undefined],
    ])('should flag %j for review', (stored) => {
      const result = convertZoomPhone(stored);

      expect(result.outcome).toBe('flagged');
      expect(result).toHaveProperty('reason', expect.any(String));
    });
  });
});
