import QueryPipeline, { Score, Stage } from '../../../../query/query-pipeline';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { Condition, Field } from '../../../../query/query-builder';
import { CaseAssignment } from '@common/cams/assignments';

type MongoScoreStage = {
  $addFields?: Record<string, object>;
  $project?: Record<string, number>;
};

type MaxTargetIdxExpr = {
  $cond: {
    if: { $gte: [string, string] };
    then: 0;
    else: 1;
  };
};

type MatchTypeBranch = {
  $cond: { if: object; then: string[]; else: string[] };
};

type ConcatArraysMatchTypesExpr = {
  $concatArrays: [MatchTypeBranch, MatchTypeBranch, MatchTypeBranch, MatchTypeBranch];
};

type MatchTypesCondExpr = {
  $cond: {
    if: { $eq: [MaxTargetIdxExpr, 0] };
    then: ConcatArraysMatchTypesExpr;
    else: ConcatArraysMatchTypesExpr;
  };
};

type ScoreBreakdownExpr = {
  exactScore: object;
  nicknameScore: object;
  phoneticScore: object;
  charPrefixScore: object;
};

type SearchMetadataExpr = {
  matchScore: string;
  matchTypes: MatchTypesCondExpr | ConcatArraysMatchTypesExpr;
  scoreBreakdown: { $cond: { if: object; then: object; else: object } } | ScoreBreakdownExpr;
};

type MongoSearchMetadataStage = {
  $addFields: {
    searchMetadata: SearchMetadataExpr;
  };
};

const { pipeline, score } = QueryPipeline;

describe('isPhoneticToken', () => {
  test('should return true for Soundex codes', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('J500')).toBe(true);
    expect(MongoAggregateRenderer.isPhoneticToken('S530')).toBe(true);
    expect(MongoAggregateRenderer.isPhoneticToken('M240')).toBe(true);
  });

  test('should return true for Metaphone codes', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('JN')).toBe(true);
    expect(MongoAggregateRenderer.isPhoneticToken('SM0')).toBe(true);
    expect(MongoAggregateRenderer.isPhoneticToken('MKSHL')).toBe(true);
  });

  test('should return false for lowercase bigrams', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('jo')).toBe(false);
    expect(MongoAggregateRenderer.isPhoneticToken('sm')).toBe(false);
    expect(MongoAggregateRenderer.isPhoneticToken('th')).toBe(false);
  });

  test('should return false for single character tokens', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('J')).toBe(false);
    expect(MongoAggregateRenderer.isPhoneticToken('A')).toBe(false);
  });

  test('should return false for mixed case tokens', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('Jo')).toBe(false);
    expect(MongoAggregateRenderer.isPhoneticToken('jN')).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(MongoAggregateRenderer.isPhoneticToken('')).toBe(false);
  });
});

describe('aggregation query renderer tests', () => {
  test('should return paginated aggregation query', () => {
    const expected = [
      {
        $match: {
          $or: [
            { uno: { $eq: 'theValue' } },
            {
              $and: [
                { two: { $eq: 45 } },
                { three: { $eq: true } },
                { $or: [{ uno: { $eq: 'hello' } }, { uno: { $eq: 'something' } }] },
              ],
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'bar',
          localField: 'uno',
          foreignField: 'uno',
          as: 'barDocs',
        },
      },
      {
        $addFields: {
          matchingBars: {
            $filter: {
              input: { $ifNull: ['$barDocs', []] },
              cond: { $eq: ['$$this.name', 'Bob Newhart'] },
            },
          },
        },
      },
      {
        $project: {
          four: 0,
          five: 0,
        },
      },
      {
        $sort: {
          uno: -1,
          two: 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: 0,
            },
            {
              $limit: 5,
            },
          ],
        },
      },
    ];

    const query = pipeline(
      queryMatch,
      queryJoin,
      queryAddFields,
      queryProject,
      querySort,
      queryPaginate,
    );

    const actual = MongoAggregateRenderer.toMongoAggregate(query);
    expect(actual).toEqual(expected);
  });

  test('should render simple filter condition', () => {
    const expected = { $eq: ['$$this.name', 'Bob Newhart'] };

    const leftOperand: Field<CaseAssignment> = {
      name: 'name',
    };

    const query: Condition<CaseAssignment> = {
      condition: 'EQUALS',
      leftOperand,
      rightOperand: 'Bob Newhart',
    };
    const actual = MongoAggregateRenderer.toMongoFilterCondition<CaseAssignment>(query);
    expect(actual).toEqual(expected);
  });

  const ifNullCases = [
    ['exists', '$ne', true],
    ['not exists', '$eq', false],
  ];
  test.each(ifNullCases)(
    'should render an $ifNull for the %s case',
    (_caseName: string, condition: string, right: boolean) => {
      const expected = {
        [condition]: [{ $ifNull: ['$$this.unassignedOn', null] }, null],
      };

      const leftOperand: Field<CaseAssignment> = {
        name: 'unassignedOn',
      };

      const query: Condition<CaseAssignment> = {
        condition: 'EXISTS',
        leftOperand,
        rightOperand: right,
      };

      const actual = MongoAggregateRenderer.toMongoFilterCondition<CaseAssignment>(query);
      expect(actual).toEqual(expected);
    },
  );

  test('should render a grouped query', () => {
    const expected = [
      {
        $match: {
          two: {
            $eq: 'hello',
          },
        },
      },
      { $group: { _id: '$userId', name: { $first: '$name' }, total: { $sum: 1 } } },
    ];

    const simpleMatch: Stage = {
      stage: 'MATCH',
      condition: 'EQUALS',
      leftOperand: { name: 'two' },
      rightOperand: 'hello',
    };

    const group: Stage = {
      stage: 'GROUP',
      groupBy: [{ name: 'userId' }],
      accumulators: [
        { accumulator: 'FIRST', as: { name: 'name' }, field: { name: 'name' } },
        { accumulator: 'COUNT', as: { name: 'total' } },
      ],
    };

    const query = pipeline(simpleMatch, group);

    const actual = MongoAggregateRenderer.toMongoAggregate(query);

    expect(actual).toEqual(expected);
  });

  test('should render a GROUP stage with composite groupBy as object _id', () => {
    const expected = [
      {
        $group: {
          _id: { dxtrId: '$dxtrId', courtId: '$courtId' },
          caseIds: { $push: '$caseId' },
          count: { $sum: 1 },
        },
      },
    ];

    const group: Stage = {
      stage: 'GROUP',
      groupBy: [{ name: 'dxtrId' }, { name: 'courtId' }],
      accumulators: [
        { accumulator: 'PUSH', as: { name: 'caseIds' }, field: { name: 'caseId' } },
        { accumulator: 'COUNT', as: { name: 'count' } },
      ],
    };

    const query = pipeline(group);
    const actual = MongoAggregateRenderer.toMongoAggregate(query);
    expect(actual).toEqual(expected);
  });

  test('should render PUSH accumulator as $push expression', () => {
    const group: Stage = {
      stage: 'GROUP',
      groupBy: [{ name: 'userId' }],
      accumulators: [{ accumulator: 'PUSH', as: { name: 'items' }, field: { name: 'itemId' } }],
    };
    const query = pipeline(group);
    const actual = MongoAggregateRenderer.toMongoAggregate(query);
    expect(actual).toEqual([{ $group: { _id: '$userId', items: { $push: '$itemId' } } }]);
  });

  test('should render a SCORE stage with multiple target fields', () => {
    const scoreStage: Score = score({
      searchWords: ['john'],
      nicknameWords: ['jonathan', 'jon'],
      searchMetaphones: ['JN'],
      nicknameMetaphones: ['JN0N'],
      targetNameFields: ['debtor.name', 'jointDebtor.name'],
      targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // 6 stages: parse words, match counts, scores, max score, searchMetadata, cleanup
    expect(result).toHaveLength(6);

    // Stage 1: parse words expressions
    expect(result[0].$addFields).toEqual(
      expect.objectContaining({ _words_0: expect.any(Object), _words_1: expect.any(Object) }),
    );

    // Stage 2: match count expressions
    expect(result[1].$addFields).toEqual(
      expect.objectContaining({
        _exactMatches_0: expect.any(Object),
        _nicknameMatches_0: expect.any(Object),
        _phoneticMatches_0: expect.any(Object),
        _charPrefixMatch_0: expect.any(Object),
        _similarLengthMatch_0: expect.any(Object),
        _exactMatches_1: expect.any(Object),
        _nicknameMatches_1: expect.any(Object),
        _phoneticMatches_1: expect.any(Object),
        _charPrefixMatch_1: expect.any(Object),
        _similarLengthMatch_1: expect.any(Object),
      }),
    );

    // Stage 3: score expressions
    expect(result[2].$addFields).toEqual(
      expect.objectContaining({ _score_0: expect.any(Object), _score_1: expect.any(Object) }),
    );

    // Stage 4: max score
    expect(result[3].$addFields).toEqual(
      expect.objectContaining({ matchScore: expect.any(Object) }),
    );

    // Stage 5: searchMetadata
    expect(result[4].$addFields).toEqual(
      expect.objectContaining({ searchMetadata: expect.any(Object) }),
    );

    // Stage 6: cleanup
    expect(result[5]).toHaveProperty('$project');
  });

  test('should render SCORE stage with word-level matching expressions', () => {
    const scoreStage: Score = score({
      searchWords: ['mike'],
      nicknameWords: ['michael', 'mikey'],
      searchMetaphones: ['MK'],
      nicknameMetaphones: ['MXL'],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Stage 1 should parse name into words using $reduce (splits on spaces and hyphens)
    const parseStage = result[0].$addFields;
    expect(parseStage._words_0).toHaveProperty('$reduce');

    // Stage 2 should have exact, nickname, phonetic, char prefix, and similar length match counts
    const matchCountStage = result[1].$addFields;
    expect(matchCountStage._exactMatches_0).toHaveProperty('$size');
    expect(matchCountStage._nicknameMatches_0).toHaveProperty('$size');
    expect(matchCountStage._phoneticMatches_0).toHaveProperty('$size');
    expect(matchCountStage._charPrefixMatch_0).toHaveProperty('$cond');
    expect(matchCountStage._similarLengthMatch_0).toHaveProperty('$cond');
  });

  test('should use correct search words for exact matching', () => {
    const scoreStage: Score = score({
      searchWords: ['john', 'smith'],
      nicknameWords: ['jonathan'],
      searchMetaphones: ['JN', 'SM0'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify exact match uses searchWords array
    const matchCountStage = result[1].$addFields;
    const exactMatchExpr = matchCountStage._exactMatches_0 as {
      $size: { $setIntersection: [string[], object] };
    };
    expect(exactMatchExpr.$size.$setIntersection[0]).toEqual(['john', 'smith']);
  });

  test('should use nickname words for nickname matching', () => {
    const scoreStage: Score = score({
      searchWords: ['mike'],
      nicknameWords: ['michael', 'mikey', 'mick'],
      searchMetaphones: ['MK'],
      nicknameMetaphones: ['MXL', 'MK'],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify nickname match uses nicknameWords array
    const matchCountStage = result[1].$addFields;
    const nicknameMatchExpr = matchCountStage._nicknameMatches_0 as {
      $size: { $setIntersection: [string[], object] };
    };
    expect(nicknameMatchExpr.$size.$setIntersection[0]).toEqual(['michael', 'mikey', 'mick']);
  });

  test('should combine search and nickname metaphones for phonetic matching', () => {
    const scoreStage: Score = score({
      searchWords: ['mike'],
      nicknameWords: ['michael'],
      searchMetaphones: ['MK'],
      nicknameMetaphones: ['MXL'],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify phonetic match combines both metaphone arrays
    const matchCountStage = result[1].$addFields;
    const phoneticMatchExpr = matchCountStage._phoneticMatches_0 as {
      $size: { $setIntersection: [string[], object] };
    };
    // First element should contain both search and nickname metaphones
    const metaphones = phoneticMatchExpr.$size.$setIntersection[0];
    expect(metaphones).toContain('MK');
    expect(metaphones).toContain('MXL');
  });

  test('should throw error when targetNameFields and targetTokenFields have different lengths', () => {
    const scoreStage: Score = {
      stage: 'SCORE',
      searchWords: ['mike'],
      nicknameWords: [],
      searchMetaphones: ['MK'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name', 'jointDebtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'], // Mismatched length
      outputField: 'matchScore',
      exactMatchWeight: 10000,
      nicknameMatchWeight: 1000,
      phoneticMatchWeight: 100,
      charPrefixWeight: 75,
    };

    expect(() => MongoAggregateRenderer.toMongoScore(scoreStage)).toThrow(
      'targetNameFields and targetTokenFields must have the same length',
    );
  });

  test('should include similar length check as phonetic qualifier (Smyth → Smith)', () => {
    // This test verifies that phonetic matches are qualified by similar word length,
    // enabling matches like Smyth → Smith (both 5 chars, same Metaphone SM0)
    // while blocking Mike → Mitchell (4 vs 8 chars)
    const scoreStage: Score = score({
      searchWords: ['smyth'],
      nicknameWords: [],
      searchMetaphones: ['SM0'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify similar length match expression is generated
    const matchCountStage = result[1].$addFields;
    expect(matchCountStage._similarLengthMatch_0).toHaveProperty('$cond');

    // Verify the score expression includes similar length as a phonetic qualifier
    const scoreExpr = result[2].$addFields._score_0 as { $add: object[] };
    const phoneticCondition = scoreExpr.$add[2] as { $cond: { if: { $or: object[] } } };
    const qualifiers = phoneticCondition.$cond.if.$or;

    // Should have 4 qualifiers: exact, nickname, char prefix, similar length
    expect(qualifiers).toHaveLength(4);
    expect(qualifiers[3]).toEqual({ $gt: ['$_similarLengthMatch_0', 0] });
  });

  test('should use size-class matching to prevent short/long word false positives', () => {
    // This test verifies that similar length matching uses "size classes" to prevent
    // false positives from phonetic collisions between short and long words.
    // - Words in same size class (both ≤4 OR both >4): ±1 tolerance allowed
    // - Words in different size classes (one ≤4, other >4): exact match required
    //
    // This prevents: "Kris" (4) → "Cross" (5) [KRS phonetic collision]
    // While preserving: "Jon" (3) → "John" (4) [legitimate variation, both ≤4]
    const scoreStage: Score = score({
      searchWords: ['kris'], // 4 chars, at boundary
      nicknameWords: [],
      searchMetaphones: ['KRS'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify the similar length expression uses size-class logic
    const matchCountStage = result[1].$addFields;
    const similarLengthExpr = matchCountStage._similarLengthMatch_0 as {
      $cond: {
        if: {
          $anyElementTrue: {
            $map: {
              input: object;
              as: string;
              in: {
                $anyElementTrue: {
                  $map: {
                    input: number[];
                    as: string;
                    in: { $lte: [object, object] };
                  };
                };
              };
            };
          };
        };
      };
    };

    // Navigate to the tolerance condition that checks size classes
    const outerMap = similarLengthExpr.$cond.if.$anyElementTrue.$map;
    const innerMapContainer = outerMap.in as { $anyElementTrue: { $map: object } };
    const innerMap = innerMapContainer.$anyElementTrue.$map as {
      in: { $lte: [object, object] };
    };
    const comparison = innerMap.in.$lte;

    // The second element should be a conditional that returns tolerance based on size class
    const toleranceCond = comparison[1] as {
      $cond: { if: { $eq: [object, object] }; then: number; else: number };
    };
    expect(toleranceCond).toHaveProperty('$cond');

    // Should compare whether both words are in same size class (both ≤4 or both >4)
    const sizeClassCheck = toleranceCond.$cond.if as { $eq: [object, object] };
    expect(sizeClassCheck).toHaveProperty('$eq');
    expect(sizeClassCheck.$eq).toHaveLength(2);

    // When same class: tolerance = 1, different class: tolerance = 0
    expect(toleranceCond.$cond.then).toBe(1); // Same size class: allow ±1
    expect(toleranceCond.$cond.else).toBe(0); // Different size classes: exact match only
  });

  test('should parse hyphenated names into separate words (jean-pierre → jean, pierre)', () => {
    // This test verifies that hyphenated names like "jean-pierre" are tokenized
    // as ["jean", "pierre"], enabling matches with search terms "jean pierre"
    const scoreStage: Score = score({
      searchWords: ['jean', 'pierre'],
      nicknameWords: [],
      searchMetaphones: ['JN', 'PR'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    // Verify the parse words expression uses $reduce to split on both spaces and hyphens
    const parseStage = result[0].$addFields;
    const wordsExpr = parseStage._words_0 as {
      $reduce: { input: { $split: [object, string] }; in: { $concatArrays: object[] } };
    };

    // Should use $reduce to flatten arrays from splitting on hyphens
    expect(wordsExpr).toHaveProperty('$reduce');
    // The input to $reduce should split the name on spaces first
    expect(wordsExpr.$reduce.input).toHaveProperty('$split');
    // The "in" expression should use $concatArrays to flatten results
    expect(wordsExpr.$reduce.in).toHaveProperty('$concatArrays');
    // The second element of $concatArrays should split on hyphens
    const concatArrays = wordsExpr.$reduce.in.$concatArrays;
    const hyphenSplit = concatArrays[1] as { $filter: { input: { $split: [string, string] } } };
    expect(hyphenSplit.$filter.input.$split[1]).toBe('-');
  });

  test('should flatten SCORE stages in pipeline', () => {
    const simpleMatch: Stage = {
      stage: 'MATCH',
      condition: 'EQUALS',
      leftOperand: { name: 'documentType' },
      rightOperand: 'SYNCED_CASE',
    };

    const scoreStage: Score = score({
      searchWords: ['jon'],
      nicknameWords: [],
      searchMetaphones: ['JN'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
      outputField: 'matchScore',
    });

    const sortStage: Stage = {
      stage: 'SORT',
      fields: [{ field: { name: 'matchScore' }, direction: 'DESCENDING' }],
    };

    const query = pipeline(simpleMatch, scoreStage, sortStage);
    const result = MongoAggregateRenderer.toMongoAggregate(query);

    // 8 stages: 1 match + 6 score stages (parse, match counts, scores, max, searchMetadata, cleanup) + 1 sort
    expect(result).toHaveLength(8);
    expect(result[0]).toHaveProperty('$match');
    expect(result[1]).toHaveProperty('$addFields'); // parse words
    expect(result[2]).toHaveProperty('$addFields'); // match counts
    expect(result[3]).toHaveProperty('$addFields'); // scores
    expect(result[4]).toHaveProperty('$addFields'); // max score
    expect(result[5]).toHaveProperty('$addFields'); // searchMetadata
    expect(result[6]).toHaveProperty('$project'); // cleanup
    expect(result[7]).toHaveProperty('$sort');
  });

  describe('toMongoScore - searchMetadata computation', () => {
    function makeScoreStage(overrides: Partial<Parameters<typeof score>[0]> = {}): Score {
      return score({
        searchWords: ['john'],
        nicknameWords: [],
        searchMetaphones: ['JN'],
        nicknameMetaphones: [],
        targetNameFields: ['debtor.name', 'jointDebtor.name'],
        targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
        outputField: 'matchScore',
        ...overrides,
      });
    }

    function getSearchMetadataStage(stages: MongoScoreStage[]): MongoSearchMetadataStage {
      const stage = stages.find(
        (s) => (s as MongoSearchMetadataStage).$addFields?.searchMetadata !== undefined,
      );
      if (!stage) throw new Error('searchMetadata stage not found');
      return stage as MongoSearchMetadataStage;
    }

    test('should produce 6 stages total (adding searchMetadata stage between max and cleanup)', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      expect(result).toHaveLength(6);
    });

    test('should include a searchMetadata field in the pipeline', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      expect(() => getSearchMetadataStage(result)).not.toThrow();
    });

    test('should have searchMetadata.matchScore referencing the outputField', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      expect(stage.$addFields.searchMetadata.matchScore).toBe('$matchScore');
    });

    test('should have searchMetadata.matchTypes as a $cond expression selecting debtor vs joint debtor', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      // Should be a $cond that compares maxTargetIdx to 0
      expect(matchTypes.$cond.if).toEqual({
        $eq: [expect.objectContaining({ $cond: expect.any(Object) }), 0],
      });
    });

    test('should determine max target by comparing _score_0 >= _score_1 ($gte)', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      // The maxTargetIdx $cond embedded inside matchTypes.$cond.if.$eq[0]
      const maxTargetIdx = matchTypes.$cond.if.$eq[0] as MaxTargetIdxExpr;
      expect(maxTargetIdx.$cond.if).toEqual({ $gte: ['$_score_0', '$_score_1'] });
      expect(maxTargetIdx.$cond.then).toBe(0);
      expect(maxTargetIdx.$cond.else).toBe(1);
    });

    test('should build matchTypes for debtor (idx 0) using $concatArrays', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      const debtorMatchTypes = matchTypes.$cond.then;
      expect(debtorMatchTypes).toHaveProperty('$concatArrays');
    });

    test('should include exact branch in debtor matchTypes expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      const branches = matchTypes.$cond.then.$concatArrays;
      const exactBranch = branches[0];
      expect(exactBranch.$cond.then).toEqual(['exact']);
      expect(exactBranch.$cond.else).toEqual([]);
    });

    test('should include nickname branch in debtor matchTypes expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      const branches = matchTypes.$cond.then.$concatArrays;
      const nicknameBranch = branches[1];
      expect(nicknameBranch.$cond.then).toEqual(['nickname']);
      expect(nicknameBranch.$cond.else).toEqual([]);
    });

    test('should include phonetic branch in debtor matchTypes expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      const branches = matchTypes.$cond.then.$concatArrays;
      const phoneticBranch = branches[2];
      expect(phoneticBranch.$cond.then).toEqual(['phonetic']);
      expect(phoneticBranch.$cond.else).toEqual([]);
      // Phonetic condition uses $and (hasPhonetic AND qualified)
      expect(phoneticBranch.$cond.if).toHaveProperty('$and');
    });

    test('should include charPrefix branch in debtor matchTypes expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.matchTypes as MatchTypesCondExpr;
      const branches = matchTypes.$cond.then.$concatArrays;
      const charPrefixBranch = branches[3];
      expect(charPrefixBranch.$cond.then).toEqual(['charPrefix']);
      expect(charPrefixBranch.$cond.else).toEqual([]);
    });

    test('should have searchMetadata.scoreBreakdown as a $cond expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      expect(stage.$addFields.searchMetadata.scoreBreakdown).toHaveProperty('$cond');
    });

    test('should use $concatArrays directly (no $cond) for matchTypes with a single target', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        makeScoreStage({
          targetNameFields: ['debtor.name'],
          targetTokenFields: ['debtor.phoneticTokens'],
        }),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      // Single target: matchTypes should be raw $concatArrays, not a $cond wrapping two targets
      expect(stage.$addFields.searchMetadata.matchTypes).toHaveProperty('$concatArrays');
      expect(stage.$addFields.searchMetadata.matchTypes).not.toHaveProperty('$cond');
      // Single target: scoreBreakdown should be a plain object with score fields, not a $cond
      expect(stage.$addFields.searchMetadata.scoreBreakdown).not.toHaveProperty('$cond');
      expect(stage.$addFields.searchMetadata.scoreBreakdown).toHaveProperty('exactScore');
    });

    test('should still clean up all temp fields in the final $project stage', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const cleanupStage = result[result.length - 1] as MongoScoreStage;
      expect(cleanupStage).toHaveProperty('$project');
      const projection = cleanupStage.$project as Record<string, number>;
      expect(projection['_words_0']).toBe(0);
      expect(projection['_exactMatches_0']).toBe(0);
      expect(projection['_score_0']).toBe(0);
    });
  });
});

const queryMatch: Stage = {
  conjunction: 'OR',
  values: [
    {
      condition: 'EQUALS',
      leftOperand: {
        name: 'uno',
      },
      rightOperand: 'theValue',
    },
    {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'two',
          },
          rightOperand: 45,
        },
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'three',
          },
          rightOperand: true,
        },
        {
          conjunction: 'OR',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: {
                name: 'uno',
              },
              rightOperand: 'hello',
            },
            {
              condition: 'EQUALS',
              leftOperand: {
                name: 'uno',
              },
              rightOperand: 'something',
            },
          ],
        },
      ],
    },
  ],
  stage: 'MATCH',
};

const queryJoin: Stage = {
  stage: 'JOIN',
  local: {
    name: 'uno',
    source: null,
  },
  foreign: {
    name: 'uno',
    source: 'bar',
  },
  alias: { name: 'barDocs' },
};

const filterCondition: Condition<CaseAssignment> = {
  condition: 'EQUALS',
  leftOperand: {
    name: 'name',
  },
  rightOperand: 'Bob Newhart',
};

const queryAddFields: Stage = {
  stage: 'ADD_FIELDS',
  fields: [
    {
      fieldToAdd: { name: 'matchingBars' },
      querySource: { name: 'barDocs' },
      query: filterCondition,
    },
  ],
};

const queryProject: Stage = {
  stage: 'EXCLUDE',
  fields: [{ name: 'four' }, { name: 'five' }],
};

const querySort: Stage = {
  stage: 'SORT',
  fields: [
    {
      field: { name: 'uno' },
      direction: 'DESCENDING',
    },
    {
      field: { name: 'two' },
      direction: 'ASCENDING',
    },
  ],
};

const queryPaginate: Stage = {
  stage: 'PAGINATE',
  skip: 0,
  limit: 5,
};
