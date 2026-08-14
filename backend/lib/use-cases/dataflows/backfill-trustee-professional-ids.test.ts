import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  readAllAcmsProfessionalRecords,
  getCandidateTrustees,
  processAcmsProfessionalRecordsPage,
} from './backfill-trustee-professional-ids';
import * as acmsTrusteeMatchHelpers from './acms-trustee-match.helpers';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { AcmsGateway, AcmsTrusteeProfessionalRecord } from '../gateways.types';
import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

const makeAcmsRecord = (
  overrides: Partial<AcmsTrusteeProfessionalRecord> = {},
): AcmsTrusteeProfessionalRecord => ({
  acmsProfessionalId: 'WA-00001',
  firstName: 'John',
  lastName: 'Doe',
  middleInitial: null,
  address1: null,
  address2: null,
  city: null,
  state: 'WA',
  zip: null,
  phone: null,
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  ({
    id: 'trustee-1',
    trusteeId: 'trustee-1',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    status: 'active',
    public: {
      address: {
        address1: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        countryCode: 'US',
      },
    },
    createdBy: { id: 'system', name: 'System' },
    createdOn: '2024-01-01T00:00:00Z',
    updatedBy: { id: 'system', name: 'System' },
    updatedOn: '2024-01-01T00:00:00Z',
    ...overrides,
  }) as Trustee;

const makeAppointment = (overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment =>
  ({
    id: 'appt-1',
    trusteeId: 'trustee-1',
    chapter: '7',
    appointmentType: 'panel',
    courtId: '098',
    appointedDate: '2020-01-01',
    status: 'active',
    effectiveDate: '2020-01-01',
    createdBy: { id: 'system', name: 'System' },
    createdOn: '2020-01-01T00:00:00Z',
    updatedBy: { id: 'system', name: 'System' },
    updatedOn: '2020-01-01T00:00:00Z',
    ...overrides,
  }) as TrusteeAppointment;

describe('Backfill Trustee Professional Ids Use Case', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    context = await createMockApplicationContext();
  });

  describe('readAllAcmsProfessionalRecords', () => {
    test('reads and returns records from the widened gateway method', async () => {
      const records = [makeAcmsRecord()];
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getAllTrusteeProfessionalRecords: vi.fn().mockResolvedValue(records),
      } as unknown as AcmsGateway);

      const result = await readAllAcmsProfessionalRecords(context);

      expect(result.data).toEqual(records);
    });

    test('returns an error when the gateway fails', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getAllTrusteeProfessionalRecords: vi.fn().mockRejectedValue(new Error('ACMS down')),
      } as unknown as AcmsGateway);

      const result = await readAllAcmsProfessionalRecords(context);

      expect(result.error).toBeDefined();
    });
  });

  describe('getCandidateTrustees', () => {
    test('returns phonetic search results, de-duped by trusteeId', async () => {
      const trusteeA = makeTrustee({ trusteeId: 'trustee-a' });
      const trusteeB = makeTrustee({ trusteeId: 'trustee-b' });

      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
        trusteeA,
        trusteeB,
        trusteeA,
      ]);

      const candidates = await getCandidateTrustees(context, makeAcmsRecord());

      expect(candidates).toHaveLength(2);
      expect(candidates.map((c) => c.trusteeId).sort()).toEqual(['trustee-a', 'trustee-b']);
    });

    test('does not fall back to an exact name+state match', async () => {
      // findTrusteeByNameAndState is deliberately never called -- an earlier version of this
      // function unioned it in as a "free recall safety net," which reintroduced the exact
      // brittle-matching strategy this dataflow exists to replace (CAMS-2-36t).
      const findTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState');
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([]);

      await getCandidateTrustees(context, makeAcmsRecord());

      expect(findTrusteeSpy).not.toHaveBeenCalled();
    });

    test('caps results at the shortlist limit (10)', async () => {
      const manyMatches = Array.from({ length: 25 }, (_, i) =>
        makeTrustee({ trusteeId: `trustee-${i}` }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue(
        manyMatches,
      );

      const candidates = await getCandidateTrustees(context, makeAcmsRecord());

      expect(candidates).toHaveLength(10);
    });
  });

  describe('processAcmsProfessionalRecordsPage', () => {
    const divisionToCourtMap = new Map<string, string>([['098', '098']]);

    test('skips already-mapped records, counts them, and never scores them', async () => {
      const record = makeAcmsRecord({ acmsProfessionalId: 'WA-00001' });

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([
        { id: 'x', trusteeId: 'trustee-1', acmsProfessionalId: 'WA-00001' } as never,
      ]);
      const cmmapSpy = vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      const findTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState');
      const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored');
      const resolveSpy = vi.spyOn(acmsTrusteeMatchHelpers, 'resolveAcmsProfessionalMatch');

      const result = await processAcmsProfessionalRecordsPage(
        context,
        [record],
        divisionToCourtMap,
      );

      expect(result.data).toEqual({ matched: 0, unmatched: 0, alreadyMapped: 1 });
      expect(findTrusteeSpy).not.toHaveBeenCalled();
      expect(searchSpy).not.toHaveBeenCalled();
      expect(resolveSpy).not.toHaveBeenCalled();
      // The gateway itself shouldn't even be asked for appointments for an already-mapped record.
      expect(
        (cmmapSpy.mock.results[0]?.value as AcmsGateway)?.getCmmapAppointmentsForProfessionalIds,
      ).not.toHaveBeenCalled();
    });

    test('batches the CMMAP+CMMDB fetch ONCE per page, not once per record', async () => {
      const records = [
        makeAcmsRecord({ acmsProfessionalId: 'WA-00001' }),
        makeAcmsRecord({ acmsProfessionalId: 'WA-00002' }),
        makeAcmsRecord({ acmsProfessionalId: 'WA-00003' }),
      ];

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([]);

      const getCmmapMock = vi.fn().mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: getCmmapMock,
      } as unknown as AcmsGateway);

      const result = await processAcmsProfessionalRecordsPage(context, records, divisionToCourtMap);

      expect(getCmmapMock).toHaveBeenCalledTimes(1);
      expect(getCmmapMock).toHaveBeenCalledWith(context, ['WA-00001', 'WA-00002', 'WA-00003']);
      // Zero candidates for every record -> all unmatched, no scoring attempted.
      expect(result.data).toEqual({ matched: 0, unmatched: 3, alreadyMapped: 0 });
    });

    test('zero candidates yields unmatched with no scoring attempted', async () => {
      const record = makeAcmsRecord();

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      const resolveSpy = vi.spyOn(acmsTrusteeMatchHelpers, 'resolveAcmsProfessionalMatch');

      const result = await processAcmsProfessionalRecordsPage(
        context,
        [record],
        divisionToCourtMap,
      );

      expect(result.data).toEqual({ matched: 0, unmatched: 1, alreadyMapped: 0 });
      // resolveAcmsProfessionalMatch itself short-circuits on zero candidates without scoring --
      // confirm it was invoked with an empty candidate list rather than skipped, since building
      // the (empty) shortlist is still this use case's job.
      expect(resolveSpy).toHaveBeenCalledWith(
        record,
        expect.objectContaining({ districts: expect.any(Set), chapters: expect.any(Set) }),
        [],
        expect.any(Map),
        expect.any(Function),
      );
    });

    test('creates a professional-id mapping when resolveAcmsProfessionalMatch returns matched', async () => {
      const record = makeAcmsRecord({ acmsProfessionalId: 'WA-00001' });
      const candidate = makeTrustee({ trusteeId: 'trustee-winner' });

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
        candidate,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      vi.spyOn(acmsTrusteeMatchHelpers, 'resolveAcmsProfessionalMatch').mockReturnValue({
        kind: 'matched',
        trusteeId: 'trustee-winner',
        score: 95,
      });
      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createProfessionalId')
        .mockResolvedValue({} as never);

      const result = await processAcmsProfessionalRecordsPage(
        context,
        [record],
        divisionToCourtMap,
      );

      expect(createSpy).toHaveBeenCalledWith(
        'trustee-winner',
        'WA-00001',
        expect.objectContaining({ id: 'SYSTEM' }),
      );
      expect(result.data).toEqual({ matched: 1, unmatched: 0, alreadyMapped: 0 });
    });

    test('unmatched outcome is only logged/counted -- no mapping created, no artifact written', async () => {
      const record = makeAcmsRecord();

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
        makeTrustee(),
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      vi.spyOn(acmsTrusteeMatchHelpers, 'resolveAcmsProfessionalMatch').mockReturnValue({
        kind: 'unmatched',
      });
      const createSpy = vi.spyOn(MockMongoRepository.prototype, 'createProfessionalId');

      const result = await processAcmsProfessionalRecordsPage(
        context,
        [record],
        divisionToCourtMap,
      );

      expect(createSpy).not.toHaveBeenCalled();
      expect(result.data).toEqual({ matched: 0, unmatched: 1, alreadyMapped: 0 });
    });

    test('builds ACMS-side and CAMS-side Sets from a mix of active/inactive/closed appointments -- no status filtering', async () => {
      const record = makeAcmsRecord({ acmsProfessionalId: 'WA-00001' });
      const candidate = makeTrustee({ trusteeId: 'trustee-1' });

      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
        candidate,
      ]);

      // ACMS side: appointment rows carry no status field at all (the batched gateway query has
      // none), but include rows spanning what would be active and long-closed cases on the ACMS
      // side -- all of them must count.
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsForProfessionalIds: vi.fn().mockResolvedValue([
          {
            acmsProfessionalId: 'WA-00001',
            caseId: '098-20-00001',
            courtDivisionCode: '098',
            chapter: '7',
          },
          {
            acmsProfessionalId: 'WA-00001',
            caseId: '098-05-00002',
            courtDivisionCode: '061',
            chapter: '13',
          },
        ]),
      } as unknown as AcmsGateway);

      // CAMS side: candidate's appointment history spans active, inactive, and terminated status
      // values -- all three must contribute to the Set the use case builds.
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        makeAppointment({ trusteeId: 'trustee-1', courtId: '098', chapter: '7', status: 'active' }),
        makeAppointment({
          trusteeId: 'trustee-1',
          courtId: '061',
          chapter: '13',
          status: 'inactive',
        }),
        makeAppointment({
          trusteeId: 'trustee-1',
          courtId: '029',
          chapter: '11',
          status: 'terminated',
        }),
      ]);

      const resolveSpy = vi
        .spyOn(acmsTrusteeMatchHelpers, 'resolveAcmsProfessionalMatch')
        .mockReturnValue({ kind: 'unmatched' });

      await processAcmsProfessionalRecordsPage(
        context,
        [record],
        new Map([
          ['098', '098'],
          ['061', '061'],
        ]),
      );

      expect(resolveSpy).toHaveBeenCalledTimes(1);
      const [, acmsAppointmentSets, , candidateAppointmentsByTrusteeId] = resolveSpy.mock.calls[0];

      expect(acmsAppointmentSets.districts).toEqual(new Set(['098', '061']));
      expect(acmsAppointmentSets.chapters).toEqual(new Set(['7', '13']));

      const candidateAppointments = candidateAppointmentsByTrusteeId.get('trustee-1');
      expect(candidateAppointments).toHaveLength(3);
      // All three statuses (active/inactive/terminated) must be present -- confirming nothing
      // was filtered out before being handed to resolveAcmsProfessionalMatch.
      expect(candidateAppointments!.map((a) => a.status).sort()).toEqual(
        ['active', 'inactive', 'terminated'].sort(),
      );
    });

    test('returns an error when a gateway call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByAcmsProfessionalIds').mockRejectedValue(
        new Error('mongo down'),
      );

      const result = await processAcmsProfessionalRecordsPage(
        context,
        [makeAcmsRecord()],
        divisionToCourtMap,
      );

      expect(result.error).toBeDefined();
    });
  });
});
