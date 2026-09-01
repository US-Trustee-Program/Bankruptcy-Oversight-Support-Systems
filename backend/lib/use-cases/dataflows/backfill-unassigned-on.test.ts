import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillUnassignedOnUseCase from './backfill-unassigned-on';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import factory from '../../factory';
import { SENTINEL_TRUSTEE_ID } from './migrate-case-appointments-constants';

function makeCaseAppointment(override: Partial<CaseAppointment> = {}): CaseAppointment {
  return {
    id: 'appt-id-1',
    caseId: '081-25-12345',
    trusteeId: 'trustee-001',
    assignedOn: '2025-01-01',
    unassignedOn: '2025-06-15',
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'Test User' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'Test User' },
    ...override,
  };
}

describe('BackfillUnassignedOnUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingBackfill', () => {
    test('should return a page of closed appointments needing backfill', async () => {
      const mockAppointment = { ...makeCaseAppointment(), _id: 'appt-id-1' };

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([
        mockAppointment,
      ]);

      const result = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(context, null, 100);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.appointments[0]._id).toBe('appt-id-1');
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe('appt-id-1');
    });

    test('should detect hasMore when results exceed limit', async () => {
      const appt1 = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const appt2 = { ...makeCaseAppointment(), _id: 'appt-id-2' };

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([
        appt1,
        appt2,
      ]);

      const result = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(context, null, 1);

      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('appt-id-1');
    });

    test('should return empty result when no closed appointments found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([]);

      const result = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.appointments.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when repo call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(context, null, 100);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('findSupersedingAppointment', () => {
    test('returns the appointment whose assignedOn is the earliest one strictly after the closed appointment', () => {
      const closed = makeCaseAppointment({
        id: 'old',
        trusteeId: 'trustee-A',
        assignedOn: '2025-01-01',
      });
      const superseding = makeCaseAppointment({
        id: 'new',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-15',
      });
      const laterStill = makeCaseAppointment({
        id: 'newer',
        trusteeId: 'trustee-C',
        assignedOn: '2025-02-01',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        laterStill,
        superseding,
      ]);

      expect(result?.id).toBe('new');
    });

    test('returns null when no appointment on the case comes after the closed one', () => {
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-06-01' });
      const earlier = makeCaseAppointment({ id: 'earlier', assignedOn: '2025-01-01' });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        earlier,
      ]);

      expect(result).toBeNull();
    });

    test('excludes surrogate rows from candidate search', () => {
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-01-01' });
      const surrogate = makeCaseAppointment({
        id: 'surrogate',
        // Real surrogate rows carry a fingerprint-hash trusteeId (writeSurrogateAppointment),
        // distinct from closed's here so this candidate is excluded by isSurrogate, not by the
        // unrelated same-trustee filter (which would pass this test even with isSurrogate removed).
        trusteeId: 'fingerprint-abc123',
        assignedOn: '2025-01-10',
        isSurrogate: true,
      });
      const real = makeCaseAppointment({
        id: 'real',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-20',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        surrogate,
        real,
      ]);

      expect(result?.id).toBe('real');
    });

    test('excludes sentinel-trustee rows from candidate search', () => {
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-01-01' });
      const sentinel = makeCaseAppointment({
        id: 'sentinel',
        trusteeId: SENTINEL_TRUSTEE_ID,
        assignedOn: '2025-01-10',
      });
      const real = makeCaseAppointment({
        id: 'real',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-20',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        sentinel,
        real,
      ]);

      expect(result?.id).toBe('real');
    });

    test('prefers a different-trustee candidate over an earlier same-trustee reassignment', () => {
      const closed = makeCaseAppointment({
        id: 'old',
        trusteeId: 'trustee-A',
        assignedOn: '2025-01-01',
      });
      const sameTrustee = makeCaseAppointment({
        id: 'same-trustee',
        trusteeId: 'trustee-A',
        assignedOn: '2025-01-10',
      });
      const differentTrustee = makeCaseAppointment({
        id: 'different-trustee',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-20',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        sameTrustee,
        differentTrustee,
      ]);

      expect(result?.id).toBe('different-trustee');
    });

    test('falls back to a later same-trustee reassignment when no different-trustee candidate exists', () => {
      // Trustee A closes, is reassigned to the same case, and no one else ever takes over. This
      // backfill only overwrites an already-known-wrong unassignedOn (see CAMS-888), so deriving
      // from the same-trustee reassignment's assignedOn is strictly safer than leaving the old
      // wall-clock-derived value in place, even though it isn't a real handoff to a new trustee.
      const closed = makeCaseAppointment({
        id: 'old',
        trusteeId: 'trustee-A',
        assignedOn: '2025-01-01',
      });
      const sameTrustee = makeCaseAppointment({
        id: 'same-trustee',
        trusteeId: 'trustee-A',
        assignedOn: '2025-08-01',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        sameTrustee,
      ]);

      expect(result?.id).toBe('same-trustee');
    });

    test('returns null when no later appointment of any kind exists', () => {
      const closed = makeCaseAppointment({
        id: 'old',
        trusteeId: 'trustee-A',
        assignedOn: '2025-01-01',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
      ]);

      expect(result).toBeNull();
    });

    test('keeps the earliest-seen candidate when a later candidate is still later than it', () => {
      // Guards the reduce's "keep current earliest" (: earliest) branch specifically: candidates
      // are NOT in assignedOn order here, so a mutant that always returned `candidate` instead of
      // `earliest` would incorrectly return 'later' (2025-01-20) instead of 'earliest' (2025-01-10).
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-01-01' });
      const earliest = makeCaseAppointment({
        id: 'earliest',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-10',
      });
      const later = makeCaseAppointment({
        id: 'later',
        trusteeId: 'trustee-C',
        assignedOn: '2025-01-20',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        earliest,
        later,
      ]);

      expect(result?.id).toBe('earliest');
    });

    test('logs a warning when two candidates tie on assignedOn', () => {
      const warnSpy = vi.spyOn(context.logger, 'warn');
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-01-01' });
      const tiedA = makeCaseAppointment({
        id: 'tied-a',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-10',
      });
      const tiedB = makeCaseAppointment({
        id: 'tied-b',
        trusteeId: 'trustee-C',
        assignedOn: '2025-01-10',
      });

      const result = BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        tiedA,
        tiedB,
      ]);

      // Pins the tie-break winner (mutation guard): the reduce's comparator is `candidate <
      // current ? candidate : current`, which is false on a tie, so the first-seen candidate
      // (tiedA) wins and is returned -- weakening `<` to `<=` would flip this to tiedB without
      // failing any other assertion here.
      expect(result?.id).toBe('tied-a');
      expect(warnSpy).toHaveBeenCalledWith(
        'BACKFILL-UNASSIGNED-ON-USE-CASE',
        expect.stringContaining('AMBIGUOUS SUPERSEDING APPOINTMENT'),
        expect.objectContaining({
          caseId: closed.caseId,
          assignedOn: '2025-01-10',
          candidateIds: expect.arrayContaining(['tied-a', 'tied-b']),
        }),
      );
    });

    test('does not log a warning when there is no tie', () => {
      const warnSpy = vi.spyOn(context.logger, 'warn');
      const closed = makeCaseAppointment({ id: 'old', assignedOn: '2025-01-01' });
      const superseding = makeCaseAppointment({
        id: 'new',
        trusteeId: 'trustee-B',
        assignedOn: '2025-01-15',
      });

      BackfillUnassignedOnUseCase.findSupersedingAppointment(context, closed, [
        closed,
        superseding,
      ]);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('correctUnassignedOn', () => {
    test('corrects unassignedOn to one day before the superseding appointment assignedOn', async () => {
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateCaseAppointment')
        .mockResolvedValue({ ...closed, unassignedOn: '2025-06-19' });

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ unassignedOn: '2025-06-19' }),
      );
    });

    test('is a no-op when unassignedOn is already correct', async () => {
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });
      const closed = {
        ...makeCaseAppointment({ unassignedOn: '2025-06-19' }),
        _id: 'appt-id-1',
      };

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('skips when no superseding appointment exists', async () => {
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([closed]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('reports failure instead of writing a malformed unassignedOn when superseding.assignedOn is invalid', async () => {
      // This migration explicitly targets historically-dirty data. DateHelper.subtractDays
      // silently returns its input unchanged on an invalid date string rather than throwing, so
      // without this guard a malformed assignedOn would get written straight into unassignedOn.
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: 'not-a-valid-date',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toContain('invalid assignedOn');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('reports failure for a calendar-invalid but YYYY-MM-DD-shaped superseding.assignedOn', async () => {
      // '2025-02-30' has the right shape but isn't a real date -- DateHelper.isValidDateString
      // now round-trips the parsed date to catch this (Date.UTC silently rolls impossible
      // components into the next month rather than rejecting them), not just checking shape.
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: '2025-02-30',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toContain('invalid assignedOn');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('reports a batch-level error when the repo cannot be obtained', async () => {
      // Exercises correctUnassignedOn's outer try/catch (distinct from the per-item catch inside
      // the loop, covered by the tests above): a failure obtaining the repository itself, before
      // the loop starts, must surface as a top-level error rather than per-item results.
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockImplementation(() => {
        throw new Error('Repository unavailable');
      });

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      // getCamsError's own .message is the generic string passed to it, not the original error's
      // message -- the actual failure cause is preserved on .originalError (via util.inspect).
      expect(result.error?.originalError).toContain('Repository unavailable');
      expect(result.data).toBeUndefined();
    });

    test('records failure when updateCaseAppointment throws', async () => {
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Write failed');
    });

    test('records failure with a stringified error when a non-Error value is thrown', async () => {
      // Covers the String(originalError) branch of the per-item catch, distinct from the
      // originalError.message branch exercised by the test above.
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const superseding = makeCaseAppointment({
        id: 'appt-id-2',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([
        closed,
        superseding,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockRejectedValue(
        'write failed as a string',
      );

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('write failed as a string');
    });

    test('records a per-item failure (not a batch-level error) when getByCaseId throws', async () => {
      const closed = { ...makeCaseAppointment(), _id: 'appt-id-1' };

      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockRejectedValue(
        new Error('Connection lost'),
      );

      const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [closed]);

      // A per-record getByCaseId failure is caught per-record (recorded as a failed result),
      // not surfaced as a batch-level error — mirrors backfillAppointmentDates' per-item handling.
      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Connection lost');
    });
  });

  describe('processBackfillPage', () => {
    const makeAppointment = (id: string, override: Partial<CaseAppointment> = {}) => ({
      ...makeCaseAppointment({ caseId: `081-25-${id}`, ...override }),
      _id: id,
    });

    test('should return empty when no closed appointments need backfill', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([]);

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('empty');
    });

    test('should return ok with nextCursor when hasMore', async () => {
      const superseding1 = makeCaseAppointment({
        id: 'sup-aaaa',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });
      const appt1 = makeAppointment('aaaa');
      const superseding2 = makeCaseAppointment({
        id: 'sup-bbbb',
        trusteeId: 'trustee-002',
        assignedOn: '2025-07-20',
      });
      const appt2 = makeAppointment('bbbb');

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([
        appt1,
        appt2,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockImplementation(
        async (caseId: string) => {
          if (caseId === appt1.caseId) return [appt1, superseding1];
          if (caseId === appt2.caseId) return [appt2, superseding2];
          return [];
        },
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockImplementation(
        async (appointment) => appointment as CaseAppointment,
      );

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 1);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toEqual({ lastId: 'aaaa' });
      expect(result.successCount).toBe(1);
    });

    test('should return ok with null nextCursor on last page', async () => {
      const superseding = makeCaseAppointment({
        id: 'sup-cccc',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });
      const appt = makeAppointment('cccc');

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([appt]);
      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([appt, superseding]);
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockImplementation(
        async (appointment) => appointment as CaseAppointment,
      );

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.nextCursor).toBeNull();
    });

    test('should return error when the page read fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('error');
    });

    test('should return error when correctUnassignedOn fails at the batch level', async () => {
      // Distinct from the page-read failure above: this exercises processBackfillPage's second
      // error-forwarding branch (correctionResult.error), reached when the page read succeeds but
      // the correction batch fails before producing per-item results. getPageNeedingBackfill and
      // correctUnassignedOn each call factory.getTrusteeCaseAppointmentsRepository independently —
      // let the first call (page read) succeed and only fail the second (correction).
      const appt = makeAppointment('ffff');
      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([appt]);
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository')
        .mockImplementationOnce(() => new MockMongoRepository())
        .mockImplementationOnce(() => {
          throw new Error('Repository unavailable');
        });

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      // Confirms the actual correction failure is what gets forwarded, not a placeholder --
      // getCamsError's .message here is the generic string correctUnassignedOn passes it, so the
      // real cause is on .originalError (see the equivalent assertion in correctUnassignedOn's
      // own "reports a batch-level error" test above).
      expect(result.error.originalError).toContain('Repository unavailable');
    });

    test('should return ok with failedResults when some appointments fail to update', async () => {
      const superseding = makeCaseAppointment({
        id: 'sup-dddd',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });
      const appt = makeAppointment('dddd');

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([appt]);
      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([appt, superseding]);
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.failedResults).toHaveLength(1);
      expect(result.failedResults[0].caseId).toBe(appt.caseId);
      expect(result.successCount).toBe(0);
    });

    test('re-running against already-corrected data is a no-op (idempotency)', async () => {
      const superseding = makeCaseAppointment({
        id: 'sup-eeee',
        trusteeId: 'trustee-002',
        assignedOn: '2025-06-20',
      });
      const appt = makeAppointment('eeee', { unassignedOn: '2025-06-19' });

      vi.spyOn(MockMongoRepository.prototype, 'findClosedAppointments').mockResolvedValue([appt]);
      vi.spyOn(MockMongoRepository.prototype, 'getByCaseId').mockResolvedValue([appt, superseding]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
