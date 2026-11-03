import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import SyncAcmsProfessionalIds from './sync-acms-professional-ids';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  AcmsProfessionalIdSyncState,
  AcmsTrusteeProfessionalDetailRecord,
} from '../gateways.types';
import { TrusteeProfessionalId } from './trustee-professional-ids.types';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import * as identifyTrusteeModule from './identify-trustee';
import { IdentifyTrusteeOutcome } from './identify-trustee';
import { serializeState, TrusteeSerializedState } from './trustee-match-pipeline';
import { buildAcmsVariant } from './acms-trustee-variant.helpers';
import { computeFingerprint } from './trustee-variant.helpers';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { NotFoundError } from '../../common-errors/not-found-error';

describe('SyncAcmsProfessionalIds', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  describe('createDeps', () => {
    test('should wire each dependency from its corresponding factory function', () => {
      const acmsGateway = {};
      const officesGateway = {};
      const trusteesRepo = {};
      const variationRepo = {};
      const professionalIdsRepo = {};
      const verificationRepo = {};
      const runtimeStateRepo = {};

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue(
        acmsGateway as ReturnType<typeof factory.getAcmsGateway>,
      );
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(
        officesGateway as ReturnType<typeof factory.getOfficesGateway>,
      );
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        trusteesRepo as ReturnType<typeof factory.getTrusteesRepository>,
      );
      vi.spyOn(factory, 'getTrusteeVariationRepository').mockReturnValue(
        variationRepo as ReturnType<typeof factory.getTrusteeVariationRepository>,
      );
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        professionalIdsRepo as ReturnType<typeof factory.getTrusteeProfessionalIdsRepository>,
      );
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        verificationRepo as ReturnType<typeof factory.getTrusteeMatchVerificationRepository>,
      );
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        runtimeStateRepo as ReturnType<typeof factory.getRuntimeStateRepository>,
      );

      const deps = SyncAcmsProfessionalIds.createDeps(context);

      expect(deps.context).toBe(context);
      expect(deps.acmsGateway).toBe(acmsGateway);
      expect(deps.officesGateway).toBe(officesGateway);
      expect(deps.trusteesRepo).toBe(trusteesRepo);
      expect(deps.variationRepo).toBe(variationRepo);
      expect(deps.professionalIdsRepo).toBe(professionalIdsRepo);
      expect(deps.verificationRepo).toBe(verificationRepo);
      expect(deps.runtimeStateRepo).toBe(runtimeStateRepo);
    });
  });

  describe('getGroupDesignators', () => {
    test('should return the distinct set of group designators across all offices', async () => {
      const offices: UstpOfficeDetails[] = [
        {
          officeCode: 'office-1',
          officeName: 'Office 1',
          idpGroupName: 'idp-1',
          regionId: '1',
          regionName: 'Region 1',
          groups: [
            { groupDesignator: 'NY', divisions: [] },
            { groupDesignator: 'UT', divisions: [] },
          ],
        },
        {
          officeCode: 'office-2',
          officeName: 'Office 2',
          idpGroupName: 'idp-2',
          regionId: '2',
          regionName: 'Region 2',
          groups: [
            { groupDesignator: 'NY', divisions: [] },
            { groupDesignator: 'AK', divisions: [] },
          ],
        },
      ];
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOfficeName: vi.fn(),
        getOffices: vi.fn().mockResolvedValue(offices),
      });

      const deps = SyncAcmsProfessionalIds.createDeps(context);
      const groupDesignators = await SyncAcmsProfessionalIds.getGroupDesignators(deps);

      expect(groupDesignators.sort()).toEqual(['AK', 'NY', 'UT']);
    });

    test('should return an empty array when there are no offices', async () => {
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOfficeName: vi.fn(),
        getOffices: vi.fn().mockResolvedValue([]),
      });

      const deps = SyncAcmsProfessionalIds.createDeps(context);
      const groupDesignators = await SyncAcmsProfessionalIds.getGroupDesignators(deps);

      expect(groupDesignators).toEqual([]);
    });
  });

  describe('resolveSyncState', () => {
    let deps: ReturnType<typeof SyncAcmsProfessionalIds.createDeps>;

    const makeState = (
      overrides: Partial<AcmsProfessionalIdSyncState> = {},
    ): AcmsProfessionalIdSyncState => ({
      id: 'existing-id',
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: { NY: 63 },
      ...overrides,
    });

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
    });

    test('should return a fresh zero bookmark for the group when no persisted state exists', async () => {
      vi.spyOn(deps.runtimeStateRepo, 'read').mockRejectedValue(
        new NotFoundError('RUNTIME-STATE-MONGO-REPOSITORY'),
      );

      const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY');

      expect(state.documentType).toBe('ACMS_PROFESSIONAL_ID_SYNC_STATE');
      expect(state.lastUstProfCodeByGroup).toEqual({ NY: 0 });
    });

    test('should rethrow any other read error rather than resetting the bookmark', async () => {
      const originalError = new Error('transient connection failure');
      vi.spyOn(deps.runtimeStateRepo, 'read').mockRejectedValue(originalError);

      await expect(SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY')).rejects.toThrow(
        originalError,
      );
    });

    test('should read the single shared document, not a group-specific one', async () => {
      const readSpy = vi
        .spyOn(deps.runtimeStateRepo, 'read')
        .mockResolvedValue(makeState({ lastUstProfCodeByGroup: { UT: 5321 } }));

      await SyncAcmsProfessionalIds.resolveSyncState(deps, 'UT');

      expect(readSpy).toHaveBeenCalledWith('ACMS_PROFESSIONAL_ID_SYNC_STATE');
    });

    test("should return only the requested group's bookmark, ignoring other groups in the shared map", async () => {
      const persisted = makeState({ lastUstProfCodeByGroup: { NY: 63, UT: 5321 } });
      vi.spyOn(deps.runtimeStateRepo, 'read').mockResolvedValue(persisted);

      const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY');

      expect(state.lastUstProfCodeByGroup).toEqual({ NY: 63 });
    });

    test('should default to zero when this group has no entry yet in the persisted map', async () => {
      const persisted = makeState({ lastUstProfCodeByGroup: { UT: 5321 } });
      vi.spyOn(deps.runtimeStateRepo, 'read').mockResolvedValue(persisted);

      const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY');

      expect(state.lastUstProfCodeByGroup).toEqual({ NY: 0 });
    });

    test('should return a fresh zero bookmark when purge is requested, ignoring any persisted state', async () => {
      const persisted = makeState();
      const readSpy = vi.spyOn(deps.runtimeStateRepo, 'read').mockResolvedValue(persisted);

      const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY', true);

      expect(readSpy).not.toHaveBeenCalled();
      expect(state.lastUstProfCodeByGroup).toEqual({ NY: 0 });
    });
  });

  describe('storeRuntimeState', () => {
    let deps: ReturnType<typeof SyncAcmsProfessionalIds.createDeps>;
    const state: AcmsProfessionalIdSyncState = {
      id: 'some-id',
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: { NY: 64 },
    };

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
    });

    test("should atomically set only this group's bookmark field", async () => {
      const setFieldSpy = vi.spyOn(deps.runtimeStateRepo, 'setField').mockResolvedValue(undefined);

      await SyncAcmsProfessionalIds.storeRuntimeState(deps, state);

      expect(setFieldSpy).toHaveBeenCalledWith(
        'ACMS_PROFESSIONAL_ID_SYNC_STATE',
        'lastUstProfCodeByGroup.NY',
        64,
      );
    });

    test('should not throw when the write fails (best-effort bookmark advance)', async () => {
      vi.spyOn(deps.runtimeStateRepo, 'setField').mockRejectedValue(new Error('write failed'));

      await expect(SyncAcmsProfessionalIds.storeRuntimeState(deps, state)).resolves.toBeUndefined();
    });
  });

  describe('purgeAll', () => {
    test('should delete all existing professional ID mappings and the sync bookmark document', async () => {
      const deps = SyncAcmsProfessionalIds.createDeps(context);
      const deleteAllSpy = vi.spyOn(deps.professionalIdsRepo, 'deleteAll').mockResolvedValue(3);
      const deleteStateSpy = vi.spyOn(deps.runtimeStateRepo, 'delete').mockResolvedValue();

      await SyncAcmsProfessionalIds.purgeAll(deps);

      expect(deleteAllSpy).toHaveBeenCalled();
      expect(deleteStateSpy).toHaveBeenCalledWith('ACMS_PROFESSIONAL_ID_SYNC_STATE');
    });
  });

  describe('processOneRecord', () => {
    let deps: ReturnType<typeof SyncAcmsProfessionalIds.createDeps>;
    const record: AcmsTrusteeProfessionalDetailRecord = {
      acmsProfessionalId: 'NY-00063',
      ustProfCode: 63,
      firstName: 'John',
      lastName: 'Smith',
    };

    const linkedProfessionalId = (
      overrides: Partial<TrusteeProfessionalId> = {},
    ): TrusteeProfessionalId => ({
      id: 'prof-id-1',
      documentType: 'TRUSTEE_PROFESSIONAL_ID',
      camsTrusteeId: 'trustee-1',
      acmsProfessionalId: 'NY-00063',
      disposition: 'linked',
      linkMethod: 'auto',
      nameMatchCount: 0,
      evidence: {
        sourceRaw: { fullName: 'John Smith' },
        sourceNormalized: {},
        memo: {},
        candidates: [],
        match: { trusteeId: 'trustee-1', score: {}, resolvedBy: 'test' },
        skip: false,
        error: null,
      },
      createdOn: '2025-01-01T00:00:00.000Z',
      createdBy: { id: 'ACMS', name: 'ACMS' },
      updatedOn: '2025-01-01T00:00:00.000Z',
      updatedBy: { id: 'ACMS', name: 'ACMS' },
      ...overrides,
    });

    const noMatchPipelineState = {
      sourceRaw: { fullName: 'John Smith', firstName: 'John', lastName: 'Smith' },
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: null,
      skip: false,
      error: null,
    };

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);
      vi.spyOn(deps.professionalIdsRepo, 'upsertProfessionalId').mockResolvedValue(
        linkedProfessionalId(),
      );
      vi.spyOn(deps.verificationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(deps.verificationRepo, 'upsertVerification').mockResolvedValue(undefined as never);
    });

    // Models ACMS records whose name is placeholder text rather than a person; the pipeline's
    // skipAdministrativePlaceholder stage detects them.
    test.each([
      ['', 'NOT ASSIGNED'],
      ['', 'DUPLICATE TRUSTEE'],
      ['', "UNITED STATES TRUSTEE'S OFFICE"],
      ['APPT AS TRUSTEE', 'UNITED STATES TRUSTEE'],
      ['', 'REOPENING PENDING'],
    ])(
      'should skip via the pipeline and gate the write by active appointments: firstName=%j lastName=%j',
      async (firstName, lastName) => {
        vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
        vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);
        const upsertSpy = vi.spyOn(deps.professionalIdsRepo, 'upsertProfessionalId');

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, {
          ...record,
          firstName,
          lastName,
        });

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(outcome).toEqual({ kind: 'skipped-not-a-person', gated: 'skipped' });
      },
    );

    test('writes a skipped-disposition record when an administrative placeholder has an active appointment', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([
        { division: '081', chapter: '7' },
      ]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId({ disposition: 'skipped' }));

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, {
        ...record,
        firstName: '',
        lastName: 'NOT ASSIGNED',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: 'skipped' }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'skipped-not-a-person', gated: 'written' });
    });

    const mockIdentification = (outcome: IdentifyTrusteeOutcome) =>
      vi.spyOn(identifyTrusteeModule, 'identifyTrustee').mockResolvedValue(outcome);

    const candidate = (trusteeId: string, camsRaw: object = {}) => ({
      camsRaw: { trusteeId, ...camsRaw },
      camsNormalized: {},
      memo: new Map(),
      scores: { doesNameMatch: { pass: true, quality: 'exact' } },
      origin: 'test',
    });

    const unresolvedState = (overrides: object = {}) =>
      serializeState({ ...noMatchPipelineState, ...overrides } as never) as TrusteeSerializedState;

    test('calls identifyTrustee with the record, its ACMS id, fingerprint and variant', async () => {
      const identifySpy = mockIdentification({
        kind: 'unresolved',
        state: unresolvedState(),
      });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      const variant = buildAcmsVariant(record);
      expect(identifySpy).toHaveBeenCalledWith(
        deps,
        expect.objectContaining({ firstName: 'John', lastName: 'Smith' }),
        'NY-00063',
        computeFingerprint(variant),
        variant,
      );
    });

    test('maps populated ACMS address, phone and fax into the source legacy block', async () => {
      const identifySpy = mockIdentification({ kind: 'unresolved', state: unresolvedState() });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, {
        ...record,
        address1: '1 Main St',
        address2: 'Suite 2',
        city: 'Albany',
        state: 'NY',
        zip: 12207,
        phone: '518-555-0100',
        fax: '518-555-0101',
      });

      expect(identifySpy.mock.calls[0][1].legacy).toEqual({
        address1: '1 Main St',
        address2: 'Suite 2',
        cityStateZipCountry: expect.stringContaining('Albany'),
        phone: '518-555-0100',
        fax: '518-555-0101',
      });
    });

    test('should write an auto-linked record, skipping the active-appointment gate, on a fingerprint link', async () => {
      mockIdentification({
        kind: 'linked',
        trusteeId: 'trustee-1',
        via: 'fingerprint',
        state: unresolvedState({
          match: { trusteeId: 'trustee-1', score: {}, resolvedBy: 'fingerprint' },
        }),
      });
      const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(gateSpy).not.toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          camsTrusteeId: 'trustee-1',
          acmsProfessionalId: 'NY-00063',
          disposition: 'linked',
          linkMethod: 'auto',
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'fingerprint' });
    });

    test('should write a name match as linked by auto, without recording a TrusteeVariation', async () => {
      mockIdentification({
        kind: 'linked',
        trusteeId: 'trustee-1',
        via: 'name',
        state: unresolvedState({
          candidates: new Map([['trustee-1', candidate('trustee-1')]]),
          match: { trusteeId: 'trustee-1', score: {}, resolvedBy: 'resolveByNameOnly' },
        }),
      });
      const createVariationSpy = vi.spyOn(deps.variationRepo, 'createVariation');
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(createVariationSpy).not.toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          camsTrusteeId: 'trustee-1',
          disposition: 'linked',
          linkMethod: 'auto',
          nameMatchCount: 1,
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'name' });
    });

    test.each(['fingerprint', 'name'] as const)(
      'should write a conflict record, bypassing the active-appointment gate, on a conflict via %s',
      async (via) => {
        mockIdentification({
          kind: 'conflict',
          via,
          existingTrusteeId: 'trustee-existing',
          state: unresolvedState({
            match: { trusteeId: 'trustee-1', score: {}, resolvedBy: 'test' },
          }),
        });
        const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');
        const upsertSpy = vi
          .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
          .mockResolvedValue(linkedProfessionalId());

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(gateSpy).not.toHaveBeenCalled();
        expect(upsertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            disposition: 'conflict',
            evidence: expect.objectContaining({ conflictingTrusteeId: 'trustee-existing' }),
          }),
          expect.objectContaining({ id: 'ACMS' }),
        );
        expect(upsertSpy.mock.calls[0][0].linkMethod).toBeUndefined();
        expect(outcome).toEqual({ kind: 'conflict', via });
      },
    );

    test('should apply the active-appointment gate and skip writing when identification is unresolved with zero active appointments', async () => {
      mockIdentification({ kind: 'unresolved', state: unresolvedState() });
      const gateSpy = vi
        .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
        .mockResolvedValue([]);
      const upsertSpy = vi.spyOn(deps.professionalIdsRepo, 'upsertProfessionalId');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(gateSpy).toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(outcome).toEqual({ kind: 'no-match', gated: 'skipped' });
    });

    test('should write a no-match record when the gate has active appointments', async () => {
      mockIdentification({ kind: 'unresolved', state: unresolvedState() });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([
        { division: '081', chapter: '7' },
      ]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId({ disposition: 'no-match' }));

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: 'no-match' }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'no-match', gated: 'written' });
    });

    test('should write an ambiguous record when two genuinely-qualifying candidates remain unresolved', async () => {
      mockIdentification({
        kind: 'unresolved',
        state: unresolvedState({
          candidates: new Map([
            ['t1', candidate('t1')],
            ['t2', candidate('t2')],
          ]),
        }),
      });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([
        { division: '081', chapter: '7' },
      ]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId({ disposition: 'ambiguous' }));

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          disposition: 'ambiguous',
          suspectDuplicateCamsTrustee: false,
          nameMatchCount: 2,
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(upsertSpy.mock.calls[0][0].linkMethod).toBeUndefined();
      expect(outcome).toEqual({ kind: 'ambiguous-task-pending' });
    });

    describe('identity tasks for ambiguous professionals', () => {
      const ambiguousState = () =>
        unresolvedState({
          candidates: new Map([
            ['t1', candidate('t1')],
            ['t2', candidate('t2')],
          ]),
        });
      const withActiveAppointment = () =>
        vi
          .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
          .mockResolvedValue([{ division: '081', chapter: '7' }]);
      const existingTask = (status: TrusteeMatchVerification['status']) =>
        ({
          id: 'existing-task',
          variant: buildAcmsVariant(record),
          status,
        }) as TrusteeMatchVerification;

      test('writes a pending caseless ACMS task carrying the pipeline state as findings', async () => {
        const state = ambiguousState();
        mockIdentification({ kind: 'unresolved', state });
        withActiveAppointment();
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');
        const variant = buildAcmsVariant(record);

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(outcome).toEqual({ kind: 'ambiguous-task-pending' });
        expect(upsertSpy).toHaveBeenCalledTimes(1);
        const task = upsertSpy.mock.calls[0][0];
        expect(task).toMatchObject({
          source: 'ACMS',
          mismatchReason: 'ambiguous',
          status: 'pending',
          taskType: 'trustee-match',
          acmsProfessionalId: 'NY-00063',
          fingerprint: computeFingerprint(variant),
          variant,
          findings: state,
          sourceTrustee: expect.objectContaining({ firstName: 'John', lastName: 'Smith' }),
        });
        expect(task.caseId).toBeUndefined();
        expect(task.courtId).toBeUndefined();
        expect(task.appointedDate).toBeUndefined();
      });

      test('gives the task the same fingerprint as the professional-id record it writes', async () => {
        mockIdentification({ kind: 'unresolved', state: ambiguousState() });
        withActiveAppointment();
        const taskSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');
        const idSpy = vi.spyOn(deps.professionalIdsRepo, 'upsertProfessionalId');

        await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(taskSpy.mock.calls[0][0].fingerprint).toBe(idSpy.mock.calls[0][0].camsTrusteeId);
      });

      test('leaves an existing pending task untouched', async () => {
        mockIdentification({ kind: 'unresolved', state: ambiguousState() });
        withActiveAppointment();
        vi.spyOn(deps.verificationRepo, 'findByFingerprint').mockResolvedValue([
          existingTask('pending'),
        ]);
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(outcome).toEqual({ kind: 'ambiguous-task-pending' });
      });

      test('leaves a resolved task untouched and reports it as already resolved', async () => {
        mockIdentification({ kind: 'unresolved', state: ambiguousState() });
        withActiveAppointment();
        vi.spyOn(deps.verificationRepo, 'findByFingerprint').mockResolvedValue([
          existingTask('approved'),
        ]);
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(outcome).toEqual({ kind: 'ambiguous-already-resolved' });
      });

      test('writes no task when the professional has no active appointment', async () => {
        mockIdentification({ kind: 'unresolved', state: ambiguousState() });
        vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(outcome).toEqual({ kind: 'ambiguous', gated: 'skipped' });
      });

      test('writes no task for a no-match professional', async () => {
        mockIdentification({ kind: 'unresolved', state: unresolvedState() });
        withActiveAppointment();
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

        await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(upsertSpy).not.toHaveBeenCalled();
      });

      test('writes no task for a conflict', async () => {
        mockIdentification({
          kind: 'conflict',
          via: 'name',
          existingTrusteeId: 'trustee-existing',
          state: ambiguousState(),
        });
        const upsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

        await SyncAcmsProfessionalIds.processOneRecord(deps, record);

        expect(upsertSpy).not.toHaveBeenCalled();
      });
    });

    test('preserves a manual link: returns without identifying or writing anything', async () => {
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
        linkedProfessionalId({ linkMethod: 'manual' }),
      ]);
      const identifySpy = vi.spyOn(identifyTrusteeModule, 'identifyTrustee');
      const idUpsertSpy = vi.spyOn(deps.professionalIdsRepo, 'upsertProfessionalId');
      const taskUpsertSpy = vi.spyOn(deps.verificationRepo, 'upsertVerification');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(outcome).toEqual({ kind: 'manual-preserved' });
      expect(identifySpy).not.toHaveBeenCalled();
      expect(idUpsertSpy).not.toHaveBeenCalled();
      expect(taskUpsertSpy).not.toHaveBeenCalled();
    });

    test('should parse groupDesignator from the acmsProfessionalId when checking active appointments', async () => {
      mockIdentification({ kind: 'unresolved', state: unresolvedState() });
      const gateSpy = vi
        .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
        .mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, {
        ...record,
        acmsProfessionalId: 'UT-05321',
      });

      expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'UT', record.ustProfCode);
    });

    test('should propagate an identifyTrustee failure so handlePage retries the whole page', async () => {
      const transientError = new TooManyRequestsError('TEST');
      vi.spyOn(identifyTrusteeModule, 'identifyTrustee').mockRejectedValue(transientError);

      await expect(SyncAcmsProfessionalIds.processOneRecord(deps, record)).rejects.toBe(
        transientError,
      );
    });

    test('should write a terminal pipeline error as an error-disposition record, gated by active appointments', async () => {
      mockIdentification({
        kind: 'unresolved',
        state: unresolvedState({ error: new UnknownError('TEST') }),
      });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([
        { division: '081', chapter: '7' },
      ]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId({ disposition: 'error' }));

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: 'error' }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'error', gated: 'written' });
    });
  });
});
