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

    // Candidates that are found but do not resolve never block a later tier.
    expect(matchSpy).toHaveBeenCalled();
    expect(searchSpy).toHaveBeenCalledWith('someone');
    expect(result.match).toBeNull();
    // Every tier's candidates stay in the outer pool.
    expect(result.candidates.size).toBe(2);
  });

  describe('a sole exact-name match from matchTrusteeByName', () => {
    const acmsKeyWest = makeDxtrTrustee({
      legacy: {
        address1: '1 Fictional Ave',
        cityStateZipCountry: 'KEY WEST FL 33040-0000',
        phone: '3055551000',
      } as never,
    });
    const camsAddress = (city: string, state: string, zipCode: string) => ({
      address1: '9 Other Rd',
      city,
      state,
      zipCode,
      countryCode: 'US' as const,
    });

    beforeEach(() => {
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 't1',
        nameScore: 100,
        nameMatchQuality: 'exact',
      });
    });

    test('does not resolve on name alone when the states conflict', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
        makeTrustee({
          trusteeId: 't1',
          public: {
            address: camsAddress('Longview', 'TX', '75601'),
            phone: { number: '903-555-2000' },
          },
        }),
      ]);

      const result = await runTrusteeMatchPipeline(context, acmsKeyWest);

      expect(result.match).toBeNull();
      expect(result.candidates.has('t1')).toBe(true);
    });

    test('resolves via resolveByPhone when the phone corroborates the sole exact-name match', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
        makeTrustee({
          trusteeId: 't1',
          public: {
            address: camsAddress('Key West', 'FL', '33040'),
            phone: { number: '305-555-1000' },
          },
        }),
      ]);

      const result = await runTrusteeMatchPipeline(context, acmsKeyWest);

      expect(result.match).toMatchObject({
        trusteeId: 't1',
        resolvedBy: 'resolveByPhone',
      });
    });
  });

  test('resolves in the recallByName tier via resolveByPhone and never reaches the later tiers', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', public: { phone: { number: '206-555-1000' } } as never }),
    ]);
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    // recallByName resolves, so the later tiers never search; only recallBySurnameExact's "doe"
    // search runs.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith('doe');
    expect(result.match?.trusteeId).toBe('t1');
    expect(result.match?.resolvedBy).toBe('resolveByPhone');
  });

  test('resolves via anchoredLevenshtein candidate pooled alongside a non-corroborating matchTrusteeByName candidate', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', firstName: 'Someone', lastName: 'Else' }),
    ]);
    const levenshteinCandidate = makeTrustee({
      trusteeId: 't2',
      firstName: 'John',
      lastName: 'Dow',
      name: 'John Dow',
      public: { phone: { number: '206-555-1000' } } as never,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'john' ? [levenshteinCandidate] : []),
    );

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    expect(result.candidates.get('t2')?.origin).toBe('recallByAnchoredLevenshtein');
    expect(result.candidates.has('t1')).toBe(true);
    expect(result.match?.trusteeId).toBe('t2');
    expect(result.match?.resolvedBy).toBe('resolveByPhone');
  });

  test('tries tokenIntersection then anchoredLevenshtein when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    // Returns the candidate for every ACMS name token, as token intersection requires.
    const tokenCandidate = makeTrustee({
      trusteeId: 't1',
      firstName: 'John',
      lastName: 'Dow',
      name: 'John Dow',
      public: { phone: { number: '206-555-1000' } } as never,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'john' || token === 'doe' ? [tokenCandidate] : []),
    );

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ legacy: { phone: '2065551000' } as never }),
    );

    expect(result.candidates.get('t1')?.origin).toBe('recallByTokenIntersection');
    expect(result.match?.trusteeId).toBe('t1');
    expect(result.match?.resolvedBy).toBe('resolveByPhone');
  });

  test('resolves a recallByName candidate with an exact name and a one-digit phone typo via resolveByPhoneWithTypo', async () => {
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
      public: { phone: { number: '410-555-1008' } } as never,
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([candidate]);

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({
        fullName: 'Sample R Testerson',
        firstName: 'Sample',
        middleName: 'R',
        lastName: 'Testerson',
        legacy: { phone: '4105551000' } as never,
      }),
    );

    expect(result.match?.trusteeId).toBe('t1');
    expect(result.match?.resolvedBy).toBe('resolveByPhoneWithTypo');
  });

  test('returns no match when every tier is exhausted', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
  });

  test('surfaces a RECALL tier IO failure as state.error by inspecting the nested result, without throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    // The orchestrator copies the nested tier's error through, so only one camsStack entry exists.
    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallBySurnameExact failed' }],
    });
    expect(result.match).toBeNull();
  });

  test('skips an administrative placeholder without searching for candidates', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const matchSpy = vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName');

    const result = await runTrusteeMatchPipeline(
      context,
      makeDxtrTrustee({ fullName: 'NOT ASSIGNED', firstName: 'NOT', lastName: 'ASSIGNED' }),
    );

    expect(result.skip).toBe(true);
    expect(searchSpy).not.toHaveBeenCalled();
    expect(matchSpy).not.toHaveBeenCalled();
  });

  test('stops with the error when the recallByName tier fails', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.error).toMatchObject({ camsStack: [{ message: 'recallByName failed' }] });
    expect(result.match).toBeNull();
  });

  test('stops with the error when a later tier fails', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => {
        if (token === 'john') throw new Error('Mongo timeout');
        return [];
      },
    );

    const result = await runTrusteeMatchPipeline(context, makeDxtrTrustee());

    expect(result.error).toMatchObject({
      camsStack: [{ message: 'recallByTokenIntersection failed' }],
    });
    expect(result.match).toBeNull();
  });
});
