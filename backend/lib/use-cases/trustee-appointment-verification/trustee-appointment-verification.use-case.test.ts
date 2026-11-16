import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { CaseAppointmentChecks } from '@common/cams/trustee-appointments';
import { NotFoundError } from '../../common-errors/not-found-error';
import {
  AppointmentTaskWrite,
  getAppointmentTaskDetail,
  listAppointmentTasks,
  openOrJoinAppointmentTask,
  refreshAppointmentTask,
} from './trustee-appointment-verification.use-case';
import { CourtsUseCase } from '../courts/courts';
import { TrusteeAppointmentsUseCase } from '../trustee-appointments/trustee-appointments';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointmentVerification } from '@common/cams/trustee-appointment-verification';

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
    ['a closed appointment (unassignedOn set)', { unassignedOn: '2024-06-30' }],
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

describe('listAppointmentTasks', () => {
  let context: ApplicationContext;

  const task: TrusteeAppointmentVerification = {
    id: 'task-1',
    documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
    taskType: 'trustee-appointment',
    trusteeId: 'trustee-1',
    courtId: '081',
    divisionCode: '1',
    chapter: '7',
    reason: 'no-appointment',
    caseIds: ['081-24-00001', '081-24-00002'],
    status: 'pending',
    createdOn: '2026-11-01T00:00:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-11-02T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const court = (overrides: Partial<CourtDivisionDetails>): CourtDivisionDetails => ({
    ...MockData.getCourts()[0],
    ...overrides,
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('lists pending tasks with court and division names and the number of cases', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
      court({
        courtId: '081',
        courtName: 'Southern District of New York',
        courtDivisionCode: '7',
        courtDivisionName: 'White Plains',
      }),
      court({
        courtId: '091',
        courtName: 'Eastern District of New York',
        courtDivisionCode: '1',
        courtDivisionName: 'Brooklyn',
      }),
      court({
        courtId: '081',
        courtName: 'Southern District of New York',
        courtDivisionCode: '1',
        courtDivisionName: 'Manhattan',
      }),
    ]);

    const result = await listAppointmentTasks(context);

    expect(search).toHaveBeenCalledWith({ status: ['pending'] });
    expect(result).toEqual([
      {
        id: 'task-1',
        documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
        taskType: 'trustee-appointment',
        trusteeId: 'trustee-1',
        courtId: '081',
        courtName: 'Southern District of New York',
        divisionCode: '1',
        courtDivisionName: 'Manhattan',
        chapter: '7',
        reason: 'no-appointment',
        status: 'pending',
        taskDate: '2026-11-01T00:00:00.000Z',
        caseCount: 2,
      },
    ]);
  });

  test('searches for the statuses named in statusParam', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([]);

    await listAppointmentTasks(context, { statusParam: 'pending,approved' });

    expect(search).toHaveBeenCalledWith({ status: ['pending', 'approved'] });
  });

  test('treats rejected as an unknown status, since no appointment task can be rejected', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);

    const result = await listAppointmentTasks(context, { statusParam: 'rejected' });

    expect(search).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('drops rejected from a mixed statusParam and searches the rest', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([]);

    await listAppointmentTasks(context, { statusParam: 'pending,rejected' });

    expect(search).toHaveBeenCalledWith({ status: ['pending'] });
  });

  test('ignores unknown statuses and whitespace around the names it keeps', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([]);

    await listAppointmentTasks(context, { statusParam: ' approved , bogus' });

    expect(search).toHaveBeenCalledWith({ status: ['approved'] });
  });

  test('returns no tasks without searching when statusParam names no valid status', async () => {
    const search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);

    const result = await listAppointmentTasks(context, { statusParam: 'bogus' });

    expect(search).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('names the court but not the division when only the court is known', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
      court({
        courtId: '081',
        courtName: 'Southern District of New York',
        courtDivisionCode: '087',
        courtDivisionName: 'White Plains',
      }),
    ]);

    const [item] = await listAppointmentTasks(context);

    expect(item.courtName).toBe('Southern District of New York');
    expect(item.courtDivisionName).toBeUndefined();
  });

  test('leaves both names out when the court is unknown', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);

    const [item] = await listAppointmentTasks(context);

    expect(item).not.toHaveProperty('courtName');
    expect(item).not.toHaveProperty('courtDivisionName');
  });
});

describe('getAppointmentTaskDetail', () => {
  let context: ApplicationContext;

  const task: TrusteeAppointmentVerification = {
    id: 'task-1',
    documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
    taskType: 'trustee-appointment',
    trusteeId: 'trustee-1',
    courtId: '081',
    divisionCode: '1',
    chapter: '7',
    reason: 'no-appointment',
    caseIds: ['081-24-00001', '081-24-00002'],
    status: 'pending',
    createdOn: '2026-11-01T00:00:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-11-02T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const court = (overrides: Partial<CourtDivisionDetails>): CourtDivisionDetails => ({
    ...MockData.getCourts()[0],
    ...overrides,
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
      court({
        courtId: '081',
        courtName: 'Southern District of New York',
        courtDivisionCode: '1',
        courtDivisionName: 'Manhattan',
      }),
    ]);
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
      MockData.getTrustee({ trusteeId: 'trustee-1', name: 'Jane Smith' }),
    );
  });

  test("includes the trustee's current name", async () => {
    const result = await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(result.trusteeName).toBe('Jane Smith');
  });

  test('propagates a failure reading the trustee record', async () => {
    const readFailure = new Error('read failed');
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(readFailure);

    await expect(getAppointmentTaskDetail(context, 'task-1', 'trustee-1')).rejects.toBe(
      readFailure,
    );
  });

  test('returns the task with resolved names and the appointments sorted by agreement, closest first', async () => {
    const worseMatch = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCode: '2',
      divisionCodes: undefined,
      chapter: '7',
      status: 'active',
    });
    const bestMatch = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCode: '1',
      divisionCodes: undefined,
      chapter: '7',
      status: 'active',
    });
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue([
      worseMatch,
      bestMatch,
    ]);

    const result = await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(result).toEqual({
      ...task,
      courtName: 'Southern District of New York',
      courtDivisionName: 'Manhattan',
      trusteeName: 'Jane Smith',
      appointments: [
        {
          ...bestMatch,
          agreement: {
            matchesCourt: true,
            matchesDivision: true,
            matchesChapter: true,
            isActive: true,
            score: 4,
          },
        },
        {
          ...worseMatch,
          agreement: {
            matchesCourt: true,
            matchesDivision: false,
            matchesChapter: true,
            isActive: true,
            score: 3,
          },
        },
      ],
    });
  });

  test('breaks a tied score by the most recently appointed', async () => {
    const older = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCode: '1',
      divisionCodes: undefined,
      chapter: '7',
      status: 'active',
      appointedDate: '2020-01-01',
    });
    const newer = MockData.getTrusteeAppointment({
      courtId: '081',
      divisionCode: '1',
      divisionCodes: undefined,
      chapter: '7',
      status: 'active',
      appointedDate: '2024-06-15',
    });
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue([
      older,
      newer,
    ]);

    const result = await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(result.appointments.map((a) => a.appointedDate)).toEqual(['2024-06-15', '2020-01-01']);
  });

  test("looks the task up by id within the caller's trustee (the shard key)", async () => {
    const findById = vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);

    await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(findById).toHaveBeenCalledWith('task-1', 'trustee-1');
  });

  test('fetches the courts once and reuses them when loading the trustee appointments', async () => {
    const courts = [court({ courtId: '081', courtDivisionCode: '1' })];
    const getCourts = vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue(courts);
    const getTrusteeAppointments = vi
      .spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments')
      .mockResolvedValue([]);

    await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getTrusteeAppointments).toHaveBeenCalledWith(context, 'trustee-1', courts);
  });

  test("fetches the trustee appointments for the task's own trustee", async () => {
    const getTrusteeAppointments = vi
      .spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments')
      .mockResolvedValue([]);

    await getAppointmentTaskDetail(context, 'task-1', 'trustee-1');

    expect(getTrusteeAppointments).toHaveBeenCalledWith(context, 'trustee-1', expect.any(Array));
  });

  test('propagates a not-found error when the task does not exist', async () => {
    const notFound = new NotFoundError('TEST');
    vi.spyOn(MockMongoRepository.prototype, 'findById').mockRejectedValue(notFound);

    await expect(getAppointmentTaskDetail(context, 'missing', 'trustee-1')).rejects.toBe(notFound);
  });
});

describe('refreshAppointmentTask', () => {
  let context: ApplicationContext;
  let resolve: ReturnType<typeof vi.spyOn>;
  let markMatched: ReturnType<typeof vi.spyOn>;

  const task: TrusteeAppointmentVerification = {
    id: 'task-1',
    documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
    taskType: 'trustee-appointment',
    trusteeId: 'trustee-1',
    courtId: '081',
    divisionCode: '1',
    chapter: '7',
    reason: 'no-appointment',
    caseIds: ['081-24-00001', '081-24-00002'],
    status: 'pending',
    createdOn: '2026-11-01T00:00:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-11-02T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };
  const taskTuple = {
    trusteeId: 'trustee-1',
    courtId: '081',
    courtDivisionCode: '1',
    chapter: '7',
  };

  const covering = MockData.getTrusteeAppointment({
    courtId: '081',
    divisionCodes: ['1'],
    chapter: '7',
    status: 'active',
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
      {
        ...MockData.getCourts()[0],
        courtId: '081',
        courtName: 'Eastern District of Missouri',
        courtDivisionCode: '1',
        courtDivisionName: 'St. Louis',
      },
    ]);
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
      MockData.getTrustee({ trusteeId: 'trustee-1', name: 'Jane Smith' }),
    );
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue([
      covering,
    ]);
    markMatched = vi
      .spyOn(MockMongoRepository.prototype, 'markTrusteeAppointmentMatched')
      .mockResolvedValue(true);
    resolve = vi.spyOn(MockMongoRepository.prototype, 'resolve').mockResolvedValue(true);
  });

  test("marks each case covered on the task's tuple as the verifier, then resolves the task as last read", async () => {
    const verifier = getCamsUserReference(context.session.user);

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(markMatched).toHaveBeenCalledTimes(2);
    for (const caseId of task.caseIds) {
      expect(markMatched).toHaveBeenCalledWith(caseId, taskTuple, verifier);
    }
    expect(resolve).toHaveBeenCalledWith('task-1', 'trustee-1', task.updatedOn, verifier);
    expect(resolve.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...markMatched.mock.invocationCallOrder),
    );
    expect(result).toEqual({
      outcome: 'resolved',
      trusteeName: 'Jane Smith',
      updatedCaseCount: 2,
      task: expect.objectContaining({
        id: 'task-1',
        status: 'approved',
        courtName: 'Eastern District of Missouri',
        courtDivisionName: 'St. Louis',
        caseCount: 2,
      }),
    });
  });

  test('counts only the cases still assigned to this trustee on the tuple, and still resolves when none are', async () => {
    markMatched.mockImplementation(async (caseId: string) => caseId === '081-24-00001');

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(resolve).toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: 'resolved', updatedCaseCount: 1 });

    markMatched.mockResolvedValue(false);
    expect(await refreshAppointmentTask(context, 'task-1', 'trustee-1')).toMatchObject({
      outcome: 'resolved',
      updatedCaseCount: 0,
    });
  });

  test('re-reads the task and covers the case that joined when the task changed before it could be resolved', async () => {
    const joined: TrusteeAppointmentVerification = {
      ...task,
      caseIds: [...task.caseIds, '081-24-00003'],
      updatedOn: '2026-11-03T00:00:00.000Z',
    };
    vi.spyOn(MockMongoRepository.prototype, 'findById')
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(joined);
    resolve.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(markMatched).toHaveBeenCalledWith('081-24-00003', taskTuple, expect.anything());
    expect(resolve).toHaveBeenLastCalledWith(
      'task-1',
      'trustee-1',
      joined.updatedOn,
      expect.anything(),
    );
    expect(result).toMatchObject({ outcome: 'resolved', updatedCaseCount: 3 });
  });

  test('re-checks coverage on each attempt, so coverage removed during the refresh leaves the task open', async () => {
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments')
      .mockResolvedValueOnce([covering])
      .mockResolvedValueOnce([{ ...covering, status: 'inactive' }]);
    resolve.mockResolvedValueOnce(false);

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(result).toMatchObject({ outcome: 'still-uncovered' });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('gives up with an error, leaving the task open, when the task keeps changing', async () => {
    resolve.mockResolvedValue(false);

    await expect(refreshAppointmentTask(context, 'task-1', 'trustee-1')).rejects.toThrow(
      'Trustee appointment task task-1 kept changing during the refresh; try again.',
    );
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  test('a task another verifier already resolved reports resolved without resolving it again', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue({
      ...task,
      status: 'approved',
    });

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(resolve).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: 'resolved', updatedCaseCount: 2 });
  });

  test.each([
    ['no appointment for the tuple', []],
    [
      'only an inactive appointment for the tuple',
      [
        MockData.getTrusteeAppointment({
          courtId: '081',
          divisionCodes: ['1'],
          chapter: '7',
          status: 'inactive',
        }),
      ],
    ],
  ])('reports still-uncovered and changes nothing when the trustee has %s', async (_, appts) => {
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue(
      appts,
    );

    const result = await refreshAppointmentTask(context, 'task-1', 'trustee-1');

    expect(result).toEqual({
      outcome: 'still-uncovered',
      courtId: '081',
      courtName: 'Eastern District of Missouri',
      divisionCode: '1',
      courtDivisionName: 'St. Louis',
      chapter: '7',
    });
    expect(markMatched).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  test('does not resolve the task when a case write fails', async () => {
    const writeFailure = new Error('write failed');
    markMatched.mockRejectedValue(writeFailure);

    await expect(refreshAppointmentTask(context, 'task-1', 'trustee-1')).rejects.toBe(writeFailure);
    expect(resolve).not.toHaveBeenCalled();
  });

  test("looks the task up within the caller's trustee and propagates not-found", async () => {
    const notFound = new NotFoundError('TEST');
    const findById = vi
      .spyOn(MockMongoRepository.prototype, 'findById')
      .mockRejectedValue(notFound);

    await expect(refreshAppointmentTask(context, 'missing', 'trustee-1')).rejects.toBe(notFound);
    expect(findById).toHaveBeenCalledWith('missing', 'trustee-1');
  });
});
