import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CaseAppointmentChecks } from '@common/cams/trustee-appointments';
import {
  AppointmentTaskWrite,
  openOrJoinAppointmentTask,
} from './trustee-appointment-verification.use-case';

const uncoveredChecks: CaseAppointmentChecks = {
  matchedCase: true,
  matchedTrustee: true,
  matchedTrusteeAppointment: false,
  matchedBy: 'professional-id',
};

const appointment: AppointmentTaskWrite = {
  caseId: '081-24-00001',
  trusteeId: 'trustee-1',
  courtId: '081',
  courtDivisionCode: '1',
  chapter: '7',
  documentType: 'CASE_APPOINTMENT',
  checks: uncoveredChecks,
};

const expectedKey = { trusteeId: 'trustee-1', courtId: '081', divisionCode: '1', chapter: '7' };

describe('openOrJoinAppointmentTask', () => {
  let context: ApplicationContext;
  let openOrJoin: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    openOrJoin = vi.spyOn(MockMongoRepository.prototype, 'openOrJoin').mockResolvedValue();
  });

  test("opens or joins with reason 'no-appointment' when the trustee has no appointment for the tuple", async () => {
    const otherChapter = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCodes: ['1'],
      chapter: '13',
      status: 'active',
    });

    await openOrJoinAppointmentTask(context, appointment, [otherChapter]);

    expect(openOrJoin).toHaveBeenCalledWith(
      expectedKey,
      '081-24-00001',
      'no-appointment',
      SYSTEM_USER_REFERENCE,
    );
  });

  test("opens or joins with reason 'appointment-inactive' when the trustee's appointment for the tuple is not active", async () => {
    const inactive = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCodes: ['1'],
      chapter: '7',
      status: 'inactive',
    });

    await openOrJoinAppointmentTask(context, appointment, [inactive]);

    expect(openOrJoin).toHaveBeenCalledWith(
      expectedKey,
      '081-24-00001',
      'appointment-inactive',
      SYSTEM_USER_REFERENCE,
    );
  });

  test('records the given user instead of SYSTEM when one is passed', async () => {
    const verifier = MockData.getCamsUserReference();

    await openOrJoinAppointmentTask(context, appointment, [], verifier);

    expect(openOrJoin).toHaveBeenCalledWith(
      expectedKey,
      '081-24-00001',
      'no-appointment',
      verifier,
    );
  });

  test.each<[string, Partial<AppointmentTaskWrite>]>([
    ['a parked row', { documentType: 'CASE_APPOINTMENT_UNATTACHED' }],
    ['a row with no checks', { checks: undefined }],
    [
      'a placeholder (matchedTrustee false)',
      { checks: { ...uncoveredChecks, matchedTrustee: false } },
    ],
    [
      'an unmatched case (matchedCase false)',
      { checks: { ...uncoveredChecks, matchedCase: false } },
    ],
    [
      'a covered appointment (matchedTrusteeAppointment true)',
      { checks: { ...uncoveredChecks, matchedTrusteeAppointment: true } },
    ],
    ['a missing courtId', { courtId: undefined }],
    ['a missing courtDivisionCode', { courtDivisionCode: undefined }],
    ['a missing chapter', { chapter: undefined }],
  ])('does not open or join a task for %s', async (_label, override) => {
    await openOrJoinAppointmentTask(context, { ...appointment, ...override }, []);

    expect(openOrJoin).not.toHaveBeenCalled();
  });

  test('propagates a repository error to the caller', async () => {
    openOrJoin.mockRejectedValue(new Error('write failed'));

    await expect(openOrJoinAppointmentTask(context, appointment, [])).rejects.toThrow(
      'write failed',
    );
  });
});
