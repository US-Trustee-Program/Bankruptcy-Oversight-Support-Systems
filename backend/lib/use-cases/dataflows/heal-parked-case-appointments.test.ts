import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import * as commonTrusteeAppointments from '@common/cams/trustee-appointments';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { ParkedAppointment } from '../gateways.types';
import {
  abandonedFiledDate,
  countAbandoned,
  HealParkedDeps,
  healParkedPage,
  healWindowStart,
} from './heal-parked-case-appointments';

const HEAL_RUN_DATE = '2026-11-09';

function makeParkedAppointment(override: Partial<ParkedAppointment> = {}): ParkedAppointment {
  return {
    _id: 'mongo-1',
    id: 'parked-1',
    caseId: '081-26-00001',
    trusteeId: 'trustee-1',
    assignedOn: '2026-11-01',
    appointedDate: '2026-11-01',
    dateFiled: '2026-10-30',
    chapter: '7',
    courtId: '0208',
    courtDivisionCode: '081',
    checks: {
      matchedCase: true,
      matchedTrustee: true,
      matchedTrusteeAppointment: false,
      matchedBy: 'professional-id',
    },
    createdOn: '2026-11-01T00:00:00Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2026-11-01T00:00:00Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    ...override,
  };
}

const syncedCase = {
  caseId: '081-26-00001',
  courtId: '0208',
  courtDivisionCode: '081',
  chapter: '7',
  dateFiled: '2026-10-30',
};

describe('heal-parked-case-appointments', () => {
  let context: ApplicationContext;
  let deps: HealParkedDeps;
  let caseAppointmentsRepo: {
    findParkedFiledOnOrAfter: ReturnType<typeof vi.fn>;
    countParkedFiledOn: ReturnType<typeof vi.fn>;
    getActiveByCaseId: ReturnType<typeof vi.fn>;
    findStrandedActiveInTrusteePartition: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    updateCaseAppointment: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let casesRepo: { getCaseOrMovedCase: ReturnType<typeof vi.fn> };
  let appointmentsRepo: { getTrusteeAppointments: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    caseAppointmentsRepo = {
      findParkedFiledOnOrAfter: vi.fn().mockResolvedValue([]),
      countParkedFiledOn: vi.fn().mockResolvedValue(0),
      getActiveByCaseId: vi.fn().mockResolvedValue(null),
      findStrandedActiveInTrusteePartition: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      updateCaseAppointment: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    casesRepo = { getCaseOrMovedCase: vi.fn().mockResolvedValue(syncedCase) };
    appointmentsRepo = { getTrusteeAppointments: vi.fn().mockResolvedValue([]) };
    deps = {
      context,
      caseAppointmentsRepo,
      casesRepo,
      appointmentsRepo,
    } as unknown as HealParkedDeps;
  });

  const run = (lastId: string | null = null) =>
    healParkedPage(deps, { healRunDate: HEAL_RUN_DATE, lastId, pageSize: 25 });

  test('the heal window starts 14 days before the heal run date; abandoned rows were filed the day before it', () => {
    expect(healWindowStart(HEAL_RUN_DATE)).toBe('2026-10-26');
    expect(abandonedFiledDate(HEAL_RUN_DATE)).toBe('2026-10-25');
  });

  test('pages parked rows filed inside the window by _id cursor', async () => {
    await run('mongo-0');

    expect(caseAppointmentsRepo.findParkedFiledOnOrAfter).toHaveBeenCalledWith(
      '2026-10-26',
      'mongo-0',
      25,
    );
  });

  test('a parked appointment whose case now exists is written as a CASE_APPOINTMENT, then the parked row is deleted', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);
    vi.spyOn(commonTrusteeAppointments, 'isAppointmentMatch').mockReturnValue(true);

    const result = await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith({
      caseId: '081-26-00001',
      trusteeId: 'trustee-1',
      assignedOn: '2026-11-01',
      appointedDate: '2026-11-01',
      courtId: '0208',
      courtDivisionCode: '081',
      chapter: '7',
      dateFiled: '2026-10-30',
      checks: {
        matchedCase: true,
        matchedTrustee: true,
        matchedTrusteeAppointment: true,
        matchedBy: 'professional-id',
      },
    });
    expect(caseAppointmentsRepo.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      caseAppointmentsRepo.delete.mock.invocationCallOrder[0],
    );
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
    expect(result).toEqual({ healed: 1, stillParked: 0, failed: 0, nextLastId: 'mongo-1' });
  });

  test('a parked appointment with no checks (written by an identity-task remap) heals with matchedBy identity-task', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ checks: undefined }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checks: expect.objectContaining({ matchedBy: 'identity-task' }),
      }),
    );
  });

  test('an older parked appointment is written closed under the active-trustee rule', async () => {
    const active: CaseAppointment = {
      id: 'active-1',
      caseId: '081-26-00001',
      trusteeId: 'trustee-2',
      assignedOn: '2026-11-05',
      createdOn: '2026-11-05T00:00:00Z',
      createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
      updatedOn: '2026-11-05T00:00:00Z',
      updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    };
    caseAppointmentsRepo.getActiveByCaseId.mockResolvedValue(active);
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    await run();

    expect(caseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-1', unassignedOn: '2026-11-04' }),
    );
  });

  test('a parked placeholder whose case now exists is written as a placed placeholder', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({
        trusteeId: 'fp-1',
        isSurrogate: true,
        variant: 'variant-1',
        checks: undefined,
      }),
    ]);

    const result = await run();

    expect(caseAppointmentsRepo.getActiveByCaseId).not.toHaveBeenCalled();
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith({
      caseId: '081-26-00001',
      trusteeId: 'fp-1',
      assignedOn: '2026-11-01',
      appointedDate: '2026-11-01',
      isSurrogate: true,
      variant: 'variant-1',
      courtId: '0208',
      courtDivisionCode: '081',
      chapter: '7',
      dateFiled: '2026-10-30',
    });
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
    expect(result.healed).toBe(1);
  });

  test.each([
    ['still missing', null],
    ['moved', { ...syncedCase, movedToCaseId: '081-26-99999' }],
  ])('a row whose case is %s stays parked', async (_label, caseOrMovedCase) => {
    casesRepo.getCaseOrMovedCase.mockResolvedValue(caseOrMovedCase);
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    const result = await run();

    expect(caseAppointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(caseAppointmentsRepo.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ healed: 0, stillParked: 1, failed: 0, nextLastId: 'mongo-1' });
  });

  test('a permanent per-row failure is logged, the row is left parked, and the page continues', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ _id: 'mongo-1', id: 'parked-1', chapter: '99' as never }),
      makeParkedAppointment({ _id: 'mongo-2', id: 'parked-2', caseId: '081-26-00002' }),
    ]);
    const errorSpy = vi.spyOn(context.logger, 'error');

    const result = await run();

    expect(caseAppointmentsRepo.delete).toHaveBeenCalledTimes(1);
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-2');
    expect(errorSpy).toHaveBeenCalled();
    expect(result).toEqual({ healed: 1, stillParked: 0, failed: 1, nextLastId: 'mongo-2' });
  });

  test('a transient error is rethrown so the whole page is retried', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);
    casesRepo.getCaseOrMovedCase.mockRejectedValue(new TooManyRequestsError('TEST'));

    await expect(run()).rejects.toThrow();
  });

  test('an empty page returns a null cursor', async () => {
    expect(await run()).toEqual({ healed: 0, stillParked: 0, failed: 0, nextLastId: null });
  });

  test('countAbandoned counts parked rows filed the day before the window start', async () => {
    caseAppointmentsRepo.countParkedFiledOn.mockResolvedValue(3);

    expect(await countAbandoned(deps, HEAL_RUN_DATE)).toBe(3);
    expect(caseAppointmentsRepo.countParkedFiledOn).toHaveBeenCalledWith('2026-10-25');
  });
});
