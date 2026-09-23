import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import SyncAcmsProfessionalIds from './sync-acms-professional-ids';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  AcmsActiveAppointment,
  AcmsProfessionalIdSyncState,
  AcmsTrusteeProfessionalDetailRecord,
} from '../gateways.types';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { TrusteeProfessionalId } from './trustee-professional-ids.types';
import * as trusteeMatchPipelineOrchestrator from './trustee-match-pipeline-orchestrator';
import { buildAcmsVariant } from './acms-trustee-variant.helpers';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { UnknownError } from '../../common-errors/unknown-error';

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
      vi.spyOn(deps.runtimeStateRepo, 'read').mockRejectedValue(new Error('not found'));

      const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, 'NY');

      expect(state.documentType).toBe('ACMS_PROFESSIONAL_ID_SYNC_STATE');
      expect(state.lastUstProfCodeByGroup).toEqual({ NY: 0 });
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

  describe('processFingerprintMatch', () => {
    let deps: ReturnType<typeof SyncAcmsProfessionalIds.createDeps>;
    const variant = 'the-variant-string';
    const fingerprint = 'the-fingerprint';

    const makeVariation = (overrides: Partial<TrusteeVariation> = {}): TrusteeVariation => ({
      id: 'v1',
      documentType: 'TRUSTEE_VARIATION',
      fingerprint,
      variant,
      trusteeId: 'trustee-1',
      createdOn: '2025-01-01T00:00:00.000Z',
      createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
      updatedOn: '2025-01-01T00:00:00.000Z',
      updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      ...overrides,
    });

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
    });

    test('should return no-match when the fingerprint bucket is empty', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);

      const result = await SyncAcmsProfessionalIds.processFingerprintMatch(
        deps,
        fingerprint,
        variant,
      );

      expect(result.kind).toBe('no-match');
    });

    test('should return no-match when the bucket has entries but none match this variant', async () => {
      const otherVariant = makeVariation({
        variant: 'a-different-variant',
        trusteeId: 'trustee-other',
      });
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([otherVariant]);

      const result = await SyncAcmsProfessionalIds.processFingerprintMatch(
        deps,
        fingerprint,
        variant,
      );

      expect(result.kind).toBe('no-match');
    });

    test('should return auto-linked with the matching trusteeId on a fingerprint hit', async () => {
      const matchingVariant = makeVariation();
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([matchingVariant]);

      const result = await SyncAcmsProfessionalIds.processFingerprintMatch(
        deps,
        fingerprint,
        variant,
      );

      expect(result).toEqual({ kind: 'auto-linked', trusteeId: 'trustee-1' });
    });
  });

  describe('processNameMatch', () => {
    let deps: ReturnType<typeof SyncAcmsProfessionalIds.createDeps>;
    const record: AcmsTrusteeProfessionalDetailRecord = {
      acmsProfessionalId: 'NY-00063',
      ustProfCode: 63,
      firstName: 'John',
      lastName: 'Smith',
    };

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
    });

    test('should run the ACMS-shaped record through runTrusteeMatchPipeline and return its serialized state', async () => {
      const pipelineState = {
        sourceRaw: { fullName: 'John Smith', firstName: 'John', lastName: 'Smith' },
        sourceNormalized: {},
        memo: new Map(),
        candidates: new Map(),
        match: { trusteeId: 'trustee-1', score: {} },
        skip: false,
        error: null,
      };
      const pipelineSpy = vi
        .spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline')
        .mockResolvedValue(pipelineState as never);

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(pipelineSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ firstName: 'John', lastName: 'Smith' }),
      );
      expect(result.match).toEqual({ trusteeId: 'trustee-1', score: {} });
    });

    test('should rethrow a transient pipeline error rather than returning it as state', async () => {
      const transientError = new TooManyRequestsError('TEST');
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
        sourceRaw: { fullName: 'John Smith' },
        sourceNormalized: {},
        memo: new Map(),
        candidates: new Map(),
        match: null,
        skip: false,
        error: transientError,
      } as never);

      await expect(SyncAcmsProfessionalIds.processNameMatch(deps, record)).rejects.toBe(
        transientError,
      );
    });

    test('should return a terminal pipeline error as normal serialized state, not throw', async () => {
      const terminalError = new UnknownError('TEST');
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
        sourceRaw: { fullName: 'John Smith' },
        sourceNormalized: {},
        memo: new Map(),
        candidates: new Map(),
        match: null,
        skip: false,
        error: terminalError,
      } as never);

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(result.error).toBe(terminalError);
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
      disposition: 'auto-linked',
      evidence: {
        sourceRaw: { fullName: 'John Smith' },
        sourceNormalized: {},
        memo: {},
        candidates: [],
        match: { trusteeId: 'trustee-1', score: {} },
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
    });

    // Real-world pattern: some ACMS professional-id records carry no real person at all - pure
    // administrative/placeholder text like "NOT ASSIGNED", "DUPLICATE TRUSTEE", or "UNITED STATES
    // TRUSTEE'S OFFICE" (an office, not a person). The pipeline's own
    // skipAdministrativePlaceholder stage (trustee-match-pipeline-stages.ts) detects this - not a
    // separate upfront check here - so the fingerprint lookup still runs first (cheap, and a
    // fingerprint hit is meaningful regardless of name shape), and the skip is persisted through
    // the same active-appointment gate every other outcome uses.
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

    test('should auto-link and skip name matching entirely on a fingerprint hit', async () => {
      const matchingVariant: TrusteeVariation = {
        id: 'v1',
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'irrelevant',
        variant: buildAcmsVariant(record),
        trusteeId: 'trustee-1',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([matchingVariant]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId());
      const pipelineSpy = vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline');
      const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(pipelineSpy).not.toHaveBeenCalled();
      expect(gateSpy).not.toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          camsTrusteeId: 'trustee-1',
          acmsProfessionalId: 'NY-00063',
          disposition: 'auto-linked',
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'fingerprint' });
    });

    test('should write a conflict record, bypassing the active-appointment gate, when a fingerprint hit resolves to a trustee already linked to this ACMS ID', async () => {
      const matchingVariant: TrusteeVariation = {
        id: 'v1',
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'irrelevant',
        variant: buildAcmsVariant(record),
        trusteeId: 'trustee-1',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([matchingVariant]);
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
        linkedProfessionalId({ camsTrusteeId: 'trustee-existing' }),
      ]);
      const pipelineSpy = vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline');
      const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(pipelineSpy).not.toHaveBeenCalled();
      expect(gateSpy).not.toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          disposition: 'conflict',
          evidence: expect.objectContaining({ conflictingTrusteeId: 'trustee-existing' }),
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'conflict', via: 'fingerprint' });
    });

    test('should fall through to name matching on a fingerprint miss', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      const pipelineSpy = vi
        .spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline')
        .mockResolvedValue(noMatchPipelineState as never);
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(pipelineSpy).toHaveBeenCalled();
    });

    test('should apply the active-appointment gate and skip writing when both fingerprint and name matching fail with zero active appointments', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue(
        noMatchPipelineState as never,
      );
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
      const activeAppointments: AcmsActiveAppointment[] = [{ division: '081', chapter: '7' }];
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue(
        noMatchPipelineState as never,
      );
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue(
        activeAppointments,
      );
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

    test('should write an ambiguous record when candidates were found but none resolved', async () => {
      const activeAppointments: AcmsActiveAppointment[] = [{ division: '081', chapter: '7' }];
      const ambiguousPipelineState = {
        ...noMatchPipelineState,
        candidates: new Map([
          [
            't1',
            {
              camsRaw: { trusteeId: 't1' },
              camsNormalized: {},
              memo: new Map(),
              scores: { doesNameMatch: { value: 100, threshold: 85, pass: true } },
              disqualifiers: [],
              origin: 'test',
            },
          ],
          [
            't2',
            {
              camsRaw: { trusteeId: 't2' },
              camsNormalized: {},
              memo: new Map(),
              scores: { doesNameMatch: { value: 100, threshold: 85, pass: true } },
              disqualifiers: [],
              origin: 'test',
            },
          ],
        ]),
      };
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue(
        ambiguousPipelineState as never,
      );
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue(
        activeAppointments,
      );
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId({ disposition: 'ambiguous' }));

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: 'ambiguous' }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'ambiguous', gated: 'written' });
    });

    test('should parse groupDesignator from the acmsProfessionalId when checking active appointments', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue(
        noMatchPipelineState as never,
      );
      const gateSpy = vi
        .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
        .mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, {
        ...record,
        acmsProfessionalId: 'UT-05321',
      });

      expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'UT', record.ustProfCode);
    });

    test('should write a conflict record, bypassing the active-appointment gate, when name matching resolves to a trustee already linked to this ACMS ID', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
        ...noMatchPipelineState,
        match: { trusteeId: 'trustee-1', score: {} },
      } as never);
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
        linkedProfessionalId({ camsTrusteeId: 'trustee-existing' }),
      ]);
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
      expect(outcome).toEqual({ kind: 'conflict', via: 'name' });
    });

    test('should ignore an existing non-auto-linked record for this ACMS ID when checking for a conflict', async () => {
      const matchingVariant: TrusteeVariation = {
        id: 'v1',
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'irrelevant',
        variant: buildAcmsVariant(record),
        trusteeId: 'trustee-1',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([matchingVariant]);
      // findByAcmsProfessionalId only ever returns auto-linked, non-conflicting records (see the
      // repository's own isRealLink filter) - a prior no-match/ambiguous/conflict record for this
      // ACMS id is invisible here, so it never counts as a conflict.
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);
      const upsertSpy = vi
        .spyOn(deps.professionalIdsRepo, 'upsertProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          camsTrusteeId: 'trustee-1',
          acmsProfessionalId: 'NY-00063',
          disposition: 'auto-linked',
        }),
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'fingerprint' });
    });

    test('should rethrow a transient pipeline error so handlePage retries the whole page', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      const transientError = new TooManyRequestsError('TEST');
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
        ...noMatchPipelineState,
        error: transientError,
      } as never);

      await expect(SyncAcmsProfessionalIds.processOneRecord(deps, record)).rejects.toBe(
        transientError,
      );
    });

    test('should write a terminal pipeline error as an error-disposition record, gated by active appointments', async () => {
      const activeAppointments: AcmsActiveAppointment[] = [{ division: '081', chapter: '7' }];
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      const terminalError = new UnknownError('TEST');
      vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
        ...noMatchPipelineState,
        error: terminalError,
      } as never);
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue(
        activeAppointments,
      );
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
