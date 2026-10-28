import {
  compareByAddressPointsThenNameQuality,
  compareByNameQuality,
  rankCandidates,
  ScoreByScorer,
} from './trustee-match-pipeline';

function scores(nameQuality: 'exact' | 'strong' | 'weak' | null, addressPoints?: number) {
  const result: ScoreByScorer = {
    doesNameMatch: nameQuality ? { pass: true, quality: nameQuality } : { pass: false },
  };
  if (addressPoints !== undefined) {
    result.doesAddressMatch = { pass: addressPoints > 0, points: addressPoints };
  }
  return result;
}

describe('trustee-match-pipeline ranking', () => {
  test('compareByNameQuality orders exact, then strong, then weak, then a failed name', () => {
    const ranked = [scores(null), scores('weak'), scores('exact'), scores('strong')].sort(
      compareByNameQuality,
    );

    expect(ranked.map((s) => s.doesNameMatch.quality ?? 'fail')).toEqual([
      'exact',
      'strong',
      'weak',
      'fail',
    ]);
  });

  test('compareByAddressPointsThenNameQuality orders by address points, highest first', () => {
    const ranked = [scores('exact', 1), scores('weak', 6), scores('strong')].sort(
      compareByAddressPointsThenNameQuality,
    );

    expect(ranked.map((s) => s.doesAddressMatch?.points ?? 0)).toEqual([6, 1, 0]);
  });

  test('compareByAddressPointsThenNameQuality breaks an address-points tie by name quality', () => {
    const ranked = [scores('weak', 3), scores('exact', 3)].sort(
      compareByAddressPointsThenNameQuality,
    );

    expect(ranked.map((s) => s.doesNameMatch.quality)).toEqual(['exact', 'weak']);
  });

  test('a tie on both address points and name quality compares equal', () => {
    expect(compareByAddressPointsThenNameQuality(scores('strong', 3), scores('strong', 3))).toBe(0);
  });

  test('rankCandidates returns candidates in pipeline rank order, keeping discovery order on a tie', () => {
    const candidate = (id: string, candidateScores: ScoreByScorer) => ({
      camsRaw: { id },
      camsNormalized: {},
      memo: {},
      scores: candidateScores,
      origin: 'recallByName',
    });
    const discovered = [
      candidate('tie-first', scores('strong', 3)),
      candidate('best', scores('exact', 6)),
      candidate('tie-second', scores('strong', 3)),
    ];

    expect(rankCandidates(discovered).map((c) => c.camsRaw.id)).toEqual([
      'best',
      'tie-first',
      'tie-second',
    ]);
    expect(discovered.map((c) => c.camsRaw.id)).toEqual(['tie-first', 'best', 'tie-second']);
  });
});
