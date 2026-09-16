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
    const johnMoon = makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Moon' });
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([johnMoon]);
    const matchSpy = vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName');
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [
        { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: 100 } as never,
      ],
    });

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ fullName: 'John Moon', lastName: 'Moon' }),
    );

    expect(matchSpy).not.toHaveBeenCalled();
    expect(result.match?.trusteeId).toBe('t1');
  });

  test('stops at surnameExact even when it does NOT resolve - no other tier runs', async () => {
    const johnMoon = makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Moon' });
    const fredMoon = makeTrustee({ trusteeId: 't2', firstName: 'Fred', lastName: 'Moon' });
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([
      johnMoon,
      fredMoon,
    ]);
    const matchSpy = vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName');
    const tokenIntersectionSpy = vi.spyOn(trusteeMatchHelpers, 'findTokenIntersectionCandidates');
    const levenshteinSpy = vi.spyOn(trusteeMatchHelpers, 'findAnchoredLevenshteinCandidates');
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ fullName: 'Someone Moon', firstName: 'Someone', lastName: 'Moon' }),
    );

    expect(matchSpy).not.toHaveBeenCalled();
    expect(tokenIntersectionSpy).not.toHaveBeenCalled();
    expect(levenshteinSpy).not.toHaveBeenCalled();
    expect(result.match).toBeNull();
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
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1' }),
    ]);
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [
        { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: 100 } as never,
      ],
    });
    const tokenIntersectionSpy = vi.spyOn(trusteeMatchHelpers, 'findTokenIntersectionCandidates');

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(tokenIntersectionSpy).not.toHaveBeenCalled();
    expect(result.match?.trusteeId).toBe('t1');
  });

  test('tries anchoredLevenshtein as a rescue when matchTrusteeByName is ambiguous and corroboration fails', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', firstName: 'Someone', lastName: 'Else' }),
    ]);
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration')
      .mockResolvedValueOnce({ kind: 'unresolved', candidateScores: [] })
      .mockResolvedValueOnce({
        kind: 'resolved',
        trusteeId: 't2',
        candidateScores: [
          { trusteeId: 't2', nameScore: 100, addressScore: 0, phoneScore: 100 } as never,
        ],
      });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });
    const levenshteinCandidate = makeTrustee({ trusteeId: 't2' });
    vi.spyOn(trusteeMatchHelpers, 'findAnchoredLevenshteinCandidates').mockResolvedValue([
      levenshteinCandidate,
    ]);

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match?.trusteeId).toBe('t2');
  });

  test('tries tokenIntersection then anchoredLevenshtein when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'findSurnameExactCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    const tokenCandidate = makeTrustee({ trusteeId: 't1' });
    vi.spyOn(trusteeMatchHelpers, 'findTokenIntersectionCandidates').mockResolvedValue([
      tokenCandidate,
    ]);
    vi.spyOn(trusteeMatchHelpers, 'findAnchoredLevenshteinCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [
        { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: 100 } as never,
      ],
    });

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match?.trusteeId).toBe('t1');
  });

  test('scores nameScore for matchTrusteeByName ambiguous candidates, enabling phoneTypoToleranceStage', async () => {
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
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });

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
    vi.spyOn(trusteeMatchHelpers, 'findTokenIntersectionCandidates').mockResolvedValue([]);
    vi.spyOn(trusteeMatchHelpers, 'findAnchoredLevenshteinCandidates').mockResolvedValue([]);

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
  });
});
