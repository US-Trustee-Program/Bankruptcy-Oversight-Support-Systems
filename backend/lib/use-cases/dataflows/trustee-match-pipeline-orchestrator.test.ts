import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { runTrusteeMatchPipeline } from './trustee-match-pipeline-orchestrator';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

describe('runTrusteeMatchPipeline', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([]);
  });

  test('resolves via the surnameExact tier and never calls matchTrusteeByName', async () => {
    const johnMoon = makeTrustee({
      trusteeId: 't1',
      firstName: 'John',
      lastName: 'Moon',
      public: {
        address: {
          address1: '1 Fictional Ave',
          city: 'Fictionburg',
          state: 'WA',
          zipCode: '98999',
          countryCode: 'US',
        },
        phone: { number: '206-555-1000' },
      },
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'moon' ? [johnMoon] : []),
    );
    const matchSpy = vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName');

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({
        fullName: 'John Moon',
        lastName: 'Moon',
        legacy: { phone: '2065551000' } as never,
      }),
    );

    expect(matchSpy).not.toHaveBeenCalled();
    expect(result.match?.trusteeId).toBe('t1');
  });

  test('tries matchTrusteeByName and later tiers when surnameExact finds candidates but none resolve', async () => {
    const johnMoon = makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Moon' });
    const fredMoon = makeTrustee({ trusteeId: 't2', firstName: 'Fred', lastName: 'Moon' });
    // recallByTokenIntersection/recallByAnchoredLevenshtein now query searchTrusteesByName
    // directly (see cams-6djma) rather than the removed findTokenIntersectionCandidates/
    // findAnchoredLevenshteinCandidates helper calls - both tiers run to completion and find
    // nothing beyond surnameExact's own "moon" query, same as this test originally intended.
    const searchSpy = vi
      .spyOn(MockMongoRepository.prototype, 'searchTrusteesByName')
      .mockImplementation(async (token: string) => (token === 'moon' ? [johnMoon, fredMoon] : []));
    const matchSpy = vi
      .spyOn(trusteeMatchHelpers, 'matchTrusteeByName')
      .mockResolvedValue({ kind: 'no-match' });

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ fullName: 'Someone Moon', firstName: 'Someone', lastName: 'Moon' }),
    );

    // Neither surname-exact candidate resolved on its own, so every later discovery tier is still
    // tried (see runTrusteeMatchPipeline's doc comment) - a same-surname, non-corroborating
    // candidate is not allowed to block the search.
    expect(matchSpy).toHaveBeenCalled();
    expect(searchSpy).toHaveBeenCalled();
    expect(result.match).toBeNull();
    // Both surname-exact candidates are still carried forward into the combined pool rather than
    // discarded, since they were real, cheap work already done.
    expect(result.candidates.size).toBe(2);
  });

  test('resolves directly via matchTrusteeByName when it returns resolved (exact-name short circuit)', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'exact',
    });

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { nameScore: 100, nameMatchQuality: 'exact' },
    });
  });

  test('resolves via matchTrusteeByName ambiguous -> corroboration, and does NOT try tokenIntersection', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', public: { phone: { number: '206-555-1000' } } as never }),
    ]);
    // recallBySurnameExact queries searchTrusteesByName directly too (anchored on the ACMS
    // record's own lastName, "doe" - see makeDxtrTrustee's default) - the beforeEach's own
    // default mockResolvedValue([]) covers that single expected call, finding nothing.
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    // matchTrusteeByName's ambiguous candidate resolved directly via corroboration, so
    // runTrusteeMatchPipeline never reaches recallByTokenIntersection/recallByAnchoredLevenshtein
    // (both now query searchTrusteesByName directly too) - only recallBySurnameExact's own single
    // "doe" query happens, never a second one from either later tier.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith('doe');
    expect(result.match?.trusteeId).toBe('t1');
  });

  test('resolves via anchoredLevenshtein candidate pooled alongside a non-corroborating matchTrusteeByName candidate', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', firstName: 'Someone', lastName: 'Else' }),
    ]);
    // recallByAnchoredLevenshtein now queries searchTrusteesByName directly, anchored on the
    // ACMS record's lastName ("doe") - see makeDxtrTrustee's default. Returns a trustee whose
    // lastName exactly matches the anchor and whose firstName is a close (edit distance 1) fuzzy
    // match, mirroring the same shape findAnchoredLevenshteinCandidates itself requires. t1
    // (matchTrusteeByName's ambiguous candidate, unrelated name, no phone) and t2 (anchoredLevenshtein's
    // candidate, real matching phone) are scored together in ONE combined pool (see
    // runTrusteeMatchPipeline's doc comment) rather than two isolated attempts - only t2 has
    // corroborating evidence, so it resolves.
    const levenshteinCandidate = makeTrustee({
      trusteeId: 't2',
      firstName: 'Jon',
      lastName: 'Doe',
      name: 'Jon Doe',
      public: { phone: { number: '206-555-1000' } } as never,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'doe' ? [levenshteinCandidate] : []),
    );

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    expect(result.match?.trusteeId).toBe('t2');
  });

  test('tries tokenIntersection then anchoredLevenshtein when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    // recallByTokenIntersection now queries searchTrusteesByName directly (see cams-6djma),
    // once per ACMS token ("john", "doe" - see makeDxtrTrustee's default fullName). A candidate
    // must be returned by EVERY token's query to survive intersection.
    const tokenCandidate = makeTrustee({
      trusteeId: 't1',
      firstName: 'John',
      lastName: 'Doe',
      public: { phone: { number: '206-555-1000' } } as never,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'john' || token === 'doe' ? [tokenCandidate] : []),
    );

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    expect(result.match?.trusteeId).toBe('t1');
  });

  test('scores nameScore for matchTrusteeByName ambiguous candidates, enabling resolveByPhoneTypoTolerance', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    const candidate = makeTrustee({
      trusteeId: 't1',
      firstName: 'Sample',
      middleName: 'R.',
      lastName: 'Testerson',
      name: 'Sample R. Testerson',
      public: {
        address: {
          address1: '606 Baltimore Ave., Suite 202',
          city: 'Baltimore',
          state: 'MD',
          zipCode: '21204-4026',
          countryCode: 'US',
        },
        phone: { number: '410-321-7908' },
      },
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([candidate]);

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({
        fullName: 'Sample R Testerson',
        firstName: 'Sample',
        middleName: 'R',
        lastName: 'Testerson',
        legacy: { phone: '4103217900' } as never,
      }),
    );

    expect(result.match?.trusteeId).toBe('t1');
  });

  test('returns no match when every tier is exhausted', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    // beforeEach's default searchTrusteesByName mock ([]) covers recallByTokenIntersection/
    // recallByAnchoredLevenshtein finding nothing, same as this test originally intended.

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
  });

  test('surfaces a RECALL tier IO failure as state.error by inspecting the nested result, without throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    // ONE camsStack entry, from recallBySurnameExact's own try/catch: this function reads
    // surnameExactResult.error explicitly and copies it through (see runTrusteeMatchPipeline),
    // rather than relying on an exception unwinding into its own outer catch - no second entry is
    // appended, since nothing here ever threw.
    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallBySurnameExact failed' }],
    });
    expect(result.match).toBeNull();
  });
});
