import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { CaseAppointment, TrusteeAppointment } from '@common/cams/trustee-appointments';
import {
  CasesRepository,
  ParkedAppointment,
  TrusteeAppointmentsRepository,
  TrusteeCaseAppointmentsRepository,
} from '../gateways.types';
import {
  abandonedFiledDate,
  countAbandoned,
  HealParkedDeps,
  healParkedPage,
  healWindowStart,
} from './heal-parked-case-appointments';

const HEAL_RUN_DATE = '2026-11-09';
const SYSTEM = { id: 'SYSTEM', name: 'SYSTEM' };

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
    createdBy: SYSTEM,
    updatedOn: '2026-11-01T00:00:00Z',
    updatedBy: SYSTEM,
    ...override,
  };
}

function makeActiveAppointment(override: Partial<CaseAppointment> = {}): CaseAppointment {
  return {
    id: 'active-1',
    caseId: '081-26-00001',
    trusteeId: 'trustee-2',
    assignedOn: '2026-11-05',
    createdOn: '2026-11-05T00:00:00Z',
    createdBy: SYSTEM,
    updatedOn: '2026-11-05T00:00:00Z',
    updatedBy: SYSTEM,
    ...override,
  };
}

/** An active trustee appointment covering the parked row's court 0208, division 081, chapter 7. */
const coveringTrusteeAppointment: TrusteeAppointment = {
  id: 'ta-1',
  trusteeId: 'trustee-1',
  chapter: '7',
  appointmentType: 'panel',
  courtId: '0208',
  divisionCodes: ['081'],
  appointedDate: '2020-01-01',
  status: 'active',
  effectiveDate: '2020-01-01',
  createdOn: '2020-01-01T00:00:00Z',
  createdBy: SYSTEM,
  updatedOn: '2020-01-01T00:00:00Z',
  updatedBy: SYSTEM,
};

const syncedCase = {
  caseId: '081-26-00001',
  courtId: '0208',
  courtDivisionCode: '081',
  chapter: '7',
  dateFiled: '2026-10-30',
};

type Repo = TrusteeCaseAppointmentsRepository;

/** Every repository method heal and applyResolvedTrustee call, typed against the interface. */
function makeCaseAppointmentsRepo() {
  return {
    findParkedFiledOnOrAfter: vi.fn<Repo['findParkedFiledOnOrAfter']>().mockResolvedValue([]),
    countParkedFiledOn: vi.fn<Repo['countParkedFiledOn']>().mockResolvedValue(0),
    getActiveByCaseId: vi.fn<Repo['getActiveByCaseId']>().mockResolvedValue(null),
    getByCaseId: vi.fn<Repo['getByCaseId']>().mockResolvedValue([]),
    existsInTrusteePartition: vi.fn<Repo['existsInTrusteePartition']>().mockResolvedValue(true),
    findStrandedActiveInTrusteePartition: vi
      .fn<Repo['findStrandedActiveInTrusteePartition']>()
      .mockResolvedValue(null),
    replaceOneInTrusteePartition: vi
      .fn<Repo['replaceOneInTrusteePartition']>()
      .mockResolvedValue(undefined),
    upsert: vi.fn<Repo['upsert']>().mockResolvedValue({} as CaseAppointment),
    updateCaseAppointment: vi
      .fn<Repo['updateCaseAppointment']>()
      .mockResolvedValue({} as CaseAppointment),
    delete: vi.fn<Repo['delete']>().mockResolvedValue(undefined),
  } satisfies Partial<Repo>;
}

describe('heal-parked-case-appointments', () => {
  let context: ApplicationContext;
  let deps: HealParkedDeps;
  let caseAppointmentsRepo: ReturnType<typeof makeCaseAppointmentsRepo>;
  let getCaseOrMovedCase: ReturnType<typeof vi.fn<CasesRepository['getCaseOrMovedCase']>>;
  let getTrusteeAppointments: ReturnType<
    typeof vi.fn<TrusteeAppointmentsRepository['getTrusteeAppointments']>
  >;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    caseAppointmentsRepo = makeCaseAppointmentsRepo();
    getCaseOrMovedCase = vi
      .fn<CasesRepository['getCaseOrMovedCase']>()
      .mockResolvedValue(syncedCase as Awaited<ReturnType<CasesRepository['getCaseOrMovedCase']>>);
    getTrusteeAppointments = vi
      .fn<TrusteeAppointmentsRepository['getTrusteeAppointments']>()
      .mockResolvedValue([]);
    deps = {
      context,
      // The stubs implement only the methods heal (and applyResolvedTrustee) call; the casts
      // widen those Pick-shaped stubs to the full interfaces deps declares.
      caseAppointmentsRepo: caseAppointmentsRepo as Partial<Repo> as Repo,
      casesRepo: { getCaseOrMovedCase } as Partial<CasesRepository> as CasesRepository,
      appointmentsRepo: {
        getTrusteeAppointments,
      } as Partial<TrusteeAppointmentsRepository> as TrusteeAppointmentsRepository,
    };
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

  test('a parked appointment whose case now exists is written as a CASE_APPOINTMENT covered by the trustee, then the parked row is deleted', async () => {
    getTrusteeAppointments.mockResolvedValue([coveringTrusteeAppointment]);
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    const result = await run();

    expect(getTrusteeAppointments).toHaveBeenCalledWith('trustee-1');
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
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
    expect(result).toEqual({ healed: 1, stillParked: 0, failed: 0, nextLastId: 'mongo-1' });
  });

  test('upserts before deleting, so a failed delete re-upserts the same natural key on the next run', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    await run();

    expect(caseAppointmentsRepo.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      caseAppointmentsRepo.delete.mock.invocationCallOrder[0],
    );
  });

  test('a parked appointment with no checks (written by an identity-task remap) heals with matchedBy identity-task and coverage recomputed', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ checks: undefined }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checks: expect.objectContaining({
          matchedBy: 'identity-task',
          matchedTrusteeAppointment: false,
        }),
      }),
    );
  });

  test('a parked appointment missing a court field is written as not covered', async () => {
    getTrusteeAppointments.mockResolvedValue([coveringTrusteeAppointment]);
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ courtDivisionCode: undefined }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
      }),
    );
  });

  test('a parked appointment without appointedDate heals on its assignedOn', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ appointedDate: undefined }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ assignedOn: '2026-11-01', appointedDate: '2026-11-01' }),
    );
  });

  test('a disposed parked appointment is written closed on its source disposition', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ unassignedOn: '2026-11-03' }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-1', unassignedOn: '2026-11-03' }),
    );
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
  });

  test('an older parked appointment is written closed under the active-trustee rule', async () => {
    caseAppointmentsRepo.getActiveByCaseId.mockResolvedValue(makeActiveAppointment());
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    await run();

    expect(caseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    // The derived close is a fallback, so a court disposition already stored is never replaced.
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-1' }),
      'CASE_APPOINTMENT',
      { fallbackUnassignedOn: '2026-11-04' },
    );
  });

  test('a parked appointment for the trustee already active on the same date writes nothing new and clears the parked row', async () => {
    caseAppointmentsRepo.getActiveByCaseId.mockResolvedValue(
      makeActiveAppointment({ trusteeId: 'trustee-1', assignedOn: '2026-11-01' }),
    );
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    const result = await run();

    expect(caseAppointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
    expect(result.healed).toBe(1);
  });

  test.each([
    ['appointment', { trusteeId: 'trustee-1' }, {}],
    [
      'placeholder',
      { trusteeId: 'fp-1', isSurrogate: true, variant: 'v-1' },
      { isSurrogate: true },
    ],
  ])(
    'a parked %s superseded by a placed row the sync wrote after the case loaded is cleared without overwriting it',
    async (_label, parkedOverride, placedOverride) => {
      // The sync wrote this placed row, closed by a later DISP_DATE, once the case was in CAMS.
      // Placed and parked rows have different natural keys, so attaching the open parked row would
      // replace the closed placed row and reopen the appointment.
      caseAppointmentsRepo.getByCaseId.mockResolvedValue([
        makeActiveAppointment({
          trusteeId: parkedOverride.trusteeId,
          assignedOn: '2026-11-01',
          unassignedOn: '2026-11-04',
          ...placedOverride,
        }),
      ]);
      caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
        makeParkedAppointment({ ...parkedOverride, checks: undefined }),
      ]);

      const result = await run();

      expect(caseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(caseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-1');
      expect(result).toEqual({ healed: 1, stillParked: 0, failed: 0, nextLastId: 'mongo-1' });
    },
  );

  test('a placed row for a different trustee or court date does not supersede the parked row', async () => {
    caseAppointmentsRepo.getByCaseId.mockResolvedValue([
      makeActiveAppointment({
        trusteeId: 'trustee-1',
        assignedOn: '2026-10-01',
        unassignedOn: '2026-10-20',
      }),
      makeActiveAppointment({
        trusteeId: 'trustee-9',
        assignedOn: '2026-11-01',
        unassignedOn: '2026-11-03',
      }),
    ]);
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-1', assignedOn: '2026-11-01' }),
    );
  });

  test('a permanent soft-close failure keeps the parked row and counts it failed', async () => {
    // The newer parked appointment replaces an older active trustee. When the old appointment's
    // close fails permanently, applyResolvedTrustee still writes the new appointment but reports
    // the failure; the parked row is kept so the failure is counted and visible.
    caseAppointmentsRepo.getActiveByCaseId.mockResolvedValue(
      makeActiveAppointment({ assignedOn: '2026-10-01' }),
    );
    caseAppointmentsRepo.updateCaseAppointment.mockRejectedValue(new Error('permanent failure'));
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);
    const errorSpy = vi.spyOn(context.logger, 'error');

    const result = await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-1' }),
    );
    expect(caseAppointmentsRepo.delete).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'HEAL-PARKED-CASE-APPOINTMENTS-USE-CASE',
      expect.stringContaining('081-26-00001'),
      expect.objectContaining({ caseId: '081-26-00001', id: 'parked-1' }),
    );
    expect(result).toEqual({ healed: 0, stillParked: 0, failed: 1, nextLastId: 'mongo-1' });
  });

  test('a parked placeholder whose case now exists is written as a placed placeholder, skipping the active-trustee rule', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({
        trusteeId: 'fp-1',
        isSurrogate: true,
        variant: 'variant-1',
        checks: undefined,
      }),
    ]);

    const result = await run();

    expect(caseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
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

  test('a disposed parked placeholder keeps its disposition when placed', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({
        trusteeId: 'fp-1',
        isSurrogate: true,
        variant: 'variant-1',
        unassignedOn: '2026-11-03',
      }),
    ]);

    await run();

    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'fp-1', unassignedOn: '2026-11-03' }),
    );
  });

  test.each([
    ['still missing', null],
    ['moved', { ...syncedCase, movedToCaseId: '081-26-99999' }],
  ])('a row whose case is %s stays parked', async (_label, caseOrMovedCase) => {
    getCaseOrMovedCase.mockResolvedValue(
      caseOrMovedCase as Awaited<ReturnType<CasesRepository['getCaseOrMovedCase']>>,
    );
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);

    const result = await run();

    expect(caseAppointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(caseAppointmentsRepo.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ healed: 0, stillParked: 1, failed: 0, nextLastId: 'mongo-1' });
  });

  test('a permanent per-row failure is logged, the row is left parked, and the page continues', async () => {
    // Chapter '99' is rejected by applyResolvedTrustee's chapter validation before any write.
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([
      makeParkedAppointment({ _id: 'mongo-1', id: 'parked-1', chapter: '99' as never }),
      makeParkedAppointment({ _id: 'mongo-2', id: 'parked-2', caseId: '081-26-00002' }),
    ]);
    const errorSpy = vi.spyOn(context.logger, 'error');

    const result = await run();

    expect(caseAppointmentsRepo.delete).toHaveBeenCalledTimes(1);
    expect(caseAppointmentsRepo.delete).toHaveBeenCalledWith('parked-2');
    expect(errorSpy).toHaveBeenCalledWith(
      'HEAL-PARKED-CASE-APPOINTMENTS-USE-CASE',
      expect.any(String),
      expect.objectContaining({ caseId: '081-26-00001', id: 'parked-1' }),
    );
    expect(result).toEqual({ healed: 1, stillParked: 0, failed: 1, nextLastId: 'mongo-2' });
  });

  test('a transient error is rethrown so the whole page is retried', async () => {
    caseAppointmentsRepo.findParkedFiledOnOrAfter.mockResolvedValue([makeParkedAppointment()]);
    getCaseOrMovedCase.mockRejectedValue(new TooManyRequestsError('TEST'));

    await expect(run()).rejects.toThrow(TooManyRequestsError);
    expect(caseAppointmentsRepo.delete).not.toHaveBeenCalled();
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
