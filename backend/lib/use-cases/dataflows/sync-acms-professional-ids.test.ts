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
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { buildAcmsVariant } from './acms-trustee-variant.helpers';

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

    test('should call matchTrusteeByName with the built DXTR-shaped trustee party', async () => {
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(matchSpy).toHaveBeenCalledWith(deps.context, expect.anything());
    });

    test('should pass firstName/middleName through unchanged when PROF_MI already holds a middle initial', async () => {
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, {
        ...record,
        firstName: 'John',
        middleInitial: 'Q',
      });

      expect(matchSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ firstName: 'John', middleName: 'Q' }),
      );
    });

    test('should split a compound PROF_FIRST_NAME into firstName + middleName when PROF_MI is empty', async () => {
      // CMMPR sometimes carries a middle name inside PROF_FIRST_NAME instead of using PROF_MI
      // (e.g. real staging data: firstName="CAROLINE RENEE", middleInitial="") — without
      // splitting, calculateNameScore's exact-match-or-initial firstName comparison can never
      // match a CAMS trustee with firstName="Caroline".
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, {
        ...record,
        firstName: 'CAROLINE RENEE',
        middleInitial: '',
        lastName: 'DJANG',
      });

      expect(matchSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ firstName: 'CAROLINE', middleName: 'RENEE' }),
      );
    });

    test('should join every space-separated token after the first into middleName for a 3+ word compound firstName', async () => {
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, {
        ...record,
        firstName: 'MARY JO ANNE',
        middleInitial: '',
      });

      expect(matchSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ firstName: 'MARY', middleName: 'JO ANNE' }),
      );
    });

    test('should not split a single-token firstName even when PROF_MI is empty', async () => {
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, {
        ...record,
        firstName: 'John',
        middleInitial: '',
      });

      expect(matchSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ firstName: 'John', middleName: '' }),
      );
    });

    test('should build fullName from the raw, unsplit fields regardless of the firstName/middleName split', async () => {
      const matchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });

      await SyncAcmsProfessionalIds.processNameMatch(deps, {
        ...record,
        firstName: 'CAROLINE RENEE',
        middleInitial: '',
        lastName: 'DJANG',
      });

      expect(matchSpy).toHaveBeenCalledWith(
        deps.context,
        expect.objectContaining({ fullName: 'CAROLINE RENEE DJANG' }),
      );
    });

    test('should return no-match when matchTrusteeByName finds no candidates', async () => {
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should return ambiguous with the unscored candidates when matchTrusteeByName finds a collision and contact corroboration does not resolve it', async () => {
      const matchCandidates = [{ trusteeId: 't1', trusteeName: 'John Smith' }] as never;
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'ambiguous',
        matchCandidates,
      });
      vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
        kind: 'unresolved',
        candidateScores: matchCandidates,
      });

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(result).toEqual({ kind: 'ambiguous', matchCandidates });
    });

    test('should call resolveByContactCorroboration with the ambiguous candidate trusteeIds', async () => {
      const matchCandidates = [
        { trusteeId: 't1', trusteeName: 'John Smith' },
        { trusteeId: 't2', trusteeName: 'Jon Smith' },
      ] as never;
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'ambiguous',
        matchCandidates,
      });
      const corroborationSpy = vi
        .spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration')
        .mockResolvedValue({ kind: 'unresolved', candidateScores: matchCandidates });

      await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(corroborationSpy).toHaveBeenCalledWith(deps.context, expect.anything(), ['t1', 't2']);
    });

    test('should return auto-linked when contact corroboration resolves an ambiguous match', async () => {
      const matchCandidates = [{ trusteeId: 't1', trusteeName: 'John Smith' }] as never;
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'ambiguous',
        matchCandidates,
      });
      vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 't1',
        candidateScores: matchCandidates,
      });

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(result).toEqual({ kind: 'auto-linked', trusteeId: 't1' });
    });

    test('should return auto-linked on a resolved name match', async () => {
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 'trustee-1',
        nameScore: 100,
        nameMatchQuality: 'exact',
      });

      const result = await SyncAcmsProfessionalIds.processNameMatch(deps, record);

      expect(result).toEqual({ kind: 'auto-linked', trusteeId: 'trustee-1' });
    });
  });

  describe('purgeAll', () => {
    test('should delete all existing professional ID mappings', async () => {
      const deps = SyncAcmsProfessionalIds.createDeps(context);
      const deleteAllSpy = vi.spyOn(deps.professionalIdsRepo, 'deleteAll').mockResolvedValue(3);

      await SyncAcmsProfessionalIds.purgeAll(deps);

      expect(deleteAllSpy).toHaveBeenCalled();
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
      createdOn: '2025-01-01T00:00:00.000Z',
      createdBy: { id: 'ACMS', name: 'ACMS' },
      updatedOn: '2025-01-01T00:00:00.000Z',
      updatedBy: { id: 'ACMS', name: 'ACMS' },
      ...overrides,
    });

    beforeEach(() => {
      deps = SyncAcmsProfessionalIds.createDeps(context);
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);
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
      const createSpy = vi
        .spyOn(deps.professionalIdsRepo, 'createProfessionalId')
        .mockResolvedValue(linkedProfessionalId());
      const nameMatchSpy = vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName');
      const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(nameMatchSpy).not.toHaveBeenCalled();
      expect(gateSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith(
        'trustee-1',
        'NY-00063',
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'fingerprint' });
    });

    test('should fall through to name matching on a fingerprint miss', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      const nameMatchSpy = vi
        .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
        .mockResolvedValue({ kind: 'no-match' });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(nameMatchSpy).toHaveBeenCalled();
    });

    test('should apply the active-appointment gate and skip writing when both fingerprint and name matching fail with zero active appointments', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
      const gateSpy = vi
        .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
        .mockResolvedValue([]);
      const createErroredSpy = vi.spyOn(deps.professionalIdsRepo, 'createErroredProfessionalId');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(gateSpy).toHaveBeenCalled();
      expect(createErroredSpy).not.toHaveBeenCalled();
      expect(outcome).toEqual({ kind: 'no-match', gated: 'skipped' });
    });

    test('should write an errored professional-id record with disposition no-match when the gate has active appointments', async () => {
      const activeAppointments: AcmsActiveAppointment[] = [{ division: '081', chapter: '7' }];
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue(
        activeAppointments,
      );
      const createErroredSpy = vi
        .spyOn(deps.professionalIdsRepo, 'createErroredProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(createErroredSpy).toHaveBeenCalledWith(
        expect.any(String),
        'NY-00063',
        expect.any(String),
        { disposition: 'no-match' },
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'no-match', gated: 'error-written' });
    });

    test('should write an errored professional-id record with disposition ambiguous and the candidate trusteeIds', async () => {
      const activeAppointments: AcmsActiveAppointment[] = [{ division: '081', chapter: '7' }];
      const matchCandidates = [
        { trusteeId: 't1', trusteeName: 'John Smith' },
        { trusteeId: 't2', trusteeName: 'Jon Smith' },
      ] as never;
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'ambiguous',
        matchCandidates,
      });
      vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional').mockResolvedValue(
        activeAppointments,
      );
      const createErroredSpy = vi
        .spyOn(deps.professionalIdsRepo, 'createErroredProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(createErroredSpy).toHaveBeenCalledWith(
        expect.any(String),
        'NY-00063',
        expect.any(String),
        { disposition: 'ambiguous', trustees: ['t1', 't2'] },
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'ambiguous', gated: 'error-written' });
    });

    test('should parse groupDesignator from the acmsProfessionalId when checking active appointments', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'ambiguous',
        matchCandidates: [],
      });
      const gateSpy = vi
        .spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional')
        .mockResolvedValue([]);

      await SyncAcmsProfessionalIds.processOneRecord(deps, {
        ...record,
        acmsProfessionalId: 'UT-05321',
      });

      expect(gateSpy).toHaveBeenCalledWith(expect.anything(), 'UT', record.ustProfCode);
    });

    test('should write a conflict errored record, bypassing the active-appointment gate, when name matching resolves to a trustee already linked to this ACMS ID', async () => {
      vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 'trustee-1',
        nameScore: 100,
        nameMatchQuality: 'exact',
      });
      vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
        linkedProfessionalId({ camsTrusteeId: 'trustee-existing' }),
      ]);
      const gateSpy = vi.spyOn(deps.acmsGateway, 'getActiveAppointmentsForProfessional');
      const createSpy = vi.spyOn(deps.professionalIdsRepo, 'createProfessionalId');
      const createErroredSpy = vi
        .spyOn(deps.professionalIdsRepo, 'createErroredProfessionalId')
        .mockResolvedValue(linkedProfessionalId());

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(gateSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
      expect(createErroredSpy).toHaveBeenCalledWith(
        expect.any(String),
        'NY-00063',
        expect.any(String),
        { disposition: 'conflict', trustees: ['trustee-existing', 'trustee-1'] },
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'conflict', via: 'name' });
    });

    test('should ignore existing errored records for this ACMS ID when checking for a conflict', async () => {
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
        linkedProfessionalId({
          camsTrusteeId: 'some-fingerprint',
          error: { disposition: 'no-match' },
        }),
      ]);
      const createSpy = vi
        .spyOn(deps.professionalIdsRepo, 'createProfessionalId')
        .mockResolvedValue(linkedProfessionalId());
      const createErroredSpy = vi.spyOn(deps.professionalIdsRepo, 'createErroredProfessionalId');

      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);

      expect(createErroredSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith(
        'trustee-1',
        'NY-00063',
        expect.objectContaining({ id: 'ACMS' }),
      );
      expect(outcome).toEqual({ kind: 'auto-linked', via: 'fingerprint' });
    });
  });
});
