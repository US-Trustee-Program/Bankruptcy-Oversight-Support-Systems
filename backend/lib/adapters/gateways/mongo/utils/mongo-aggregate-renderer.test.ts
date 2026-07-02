import QueryPipeline, { Score, Stage } from '../../../../query/query-pipeline';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { Condition, Field } from '../../../../query/query-builder';
import { CaseAssignment } from '@common/cams/assignments';

type MongoScoreStage = {
  $addFields?: Record<string, object>;
  $project?: Record<string, number>;
};

type MongoCondExpr = {
  $cond: {
    if: Record<string, unknown>;
    then: unknown;
    else: unknown;
  };
};

type MongoArrayElemAtExpr = {
  $arrayElemAt: [Record<string, unknown>, number];
};

type MongoMatchTypeItem = {
  type: string;
  score: {
    $cond?: {
      if: Record<string, unknown>;
    };
  };
};

type MongoMapExpr = {
  $map: {
    input: {
      $sortArray: {
        input: {
          $filter: {
            input: MongoMatchTypeItem[];
          };
        };
        sortBy: Record<string, number>;
      };
    };
    in?: string;
  };
};

type MongoSearchMetadataStage = {
  $addFields: {
    searchMetadata: {
      matchScore: string;
      primaryMatchType: MongoCondExpr | MongoArrayElemAtExpr;
      scoreBreakdown: MongoCondExpr;
    };
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
  // Shared helpers for toMongoScore tests — used in both nested describes below
  function makeScoreStage(overrides: Partial<Parameters<typeof score>[0]> = {}): Score {
    return score({
      searchWords: ['john'],
      nicknameWords: [],
      searchMetaphones: ['JN'],
      nicknameMetaphones: [],
      targetNameFields: ['debtor.name'],
      targetTokenFields: ['debtor.phoneticTokens'],
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
        $unwind: {
          path: '$barDocs',
          preserveNullAndEmptyArrays: false,
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

  test.each([
    ['EQUALS', '$eq', 'value'],
    ['GREATER_THAN', '$gt', 10],
    ['GREATER_THAN_OR_EQUAL', '$gte', 10],
    ['LESS_THAN', '$lt', 10],
    ['LESS_THAN_OR_EQUAL', '$lte', 10],
    ['NOT_EQUALS', '$ne', 'other'],
    ['CONTAINS', '$in', ['a', 'b']],
    ['NOT_CONTAINS', '$nin', ['a', 'b']],
    ['REGEX', '$regex', '^prefix'],
  ] as const)(
    'toMongoFilterCondition should render %s condition to %s',
    (condition, mongoOp, rightOperand) => {
      const leftOperand: Field<CaseAssignment> = { name: 'name' };
      const query: Condition<CaseAssignment> = {
        condition: condition as Condition<CaseAssignment>['condition'],
        leftOperand,
        rightOperand,
      };
      const actual = MongoAggregateRenderer.toMongoFilterCondition<CaseAssignment>(query);
      expect(actual).toEqual({ [mongoOp]: [`$$this.name`, rightOperand] });
    },
  );

  test('toMongoFilterCondition should return undefined for a Conjunction input', () => {
    const conjunction = { conjunction: 'AND' as const, values: [], stage: 'MATCH' as const };
    const actual = MongoAggregateRenderer.toMongoFilterCondition(conjunction as never);
    expect(actual).toBeUndefined();
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

    expect(result).toHaveLength(6);

    const [
      parseWordsStage,
      matchCountsStage,
      scoresStage,
      maxScoreStage,
      searchMetadataStage,
      cleanupStage,
    ] = result;

    expect(parseWordsStage.$addFields).toEqual(
      expect.objectContaining({ _words_0: expect.any(Object), _words_1: expect.any(Object) }),
    );

    expect(matchCountsStage.$addFields).toEqual(
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

    expect(scoresStage.$addFields).toEqual(
      expect.objectContaining({ _score_0: expect.any(Object), _score_1: expect.any(Object) }),
    );

    expect(maxScoreStage.$addFields).toEqual(
      expect.objectContaining({ matchScore: expect.any(Object) }),
    );

    expect(searchMetadataStage.$addFields).toEqual(
      expect.objectContaining({ searchMetadata: expect.any(Object) }),
    );

    expect(cleanupStage).toHaveProperty('$project');
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

    const parseWordsStage = result[0].$addFields;
    expect(parseWordsStage._words_0).toHaveProperty('$reduce');

    const matchCountsStage = result[1].$addFields;
    expect(matchCountsStage._exactMatches_0).toHaveProperty('$size');
    expect(matchCountsStage._nicknameMatches_0).toHaveProperty('$size');
    expect(matchCountsStage._phoneticMatches_0).toHaveProperty('$size');
    expect(matchCountsStage._charPrefixMatch_0).toHaveProperty('$cond');
    expect(matchCountsStage._similarLengthMatch_0).toHaveProperty('$cond');
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

    const matchCountsStage = result[1].$addFields;
    const exactMatchExpr = matchCountsStage._exactMatches_0 as {
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

    const matchCountsStage = result[1].$addFields;
    const nicknameMatchExpr = matchCountsStage._nicknameMatches_0 as {
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

    const matchCountsStage = result[1].$addFields;
    const phoneticMatchExpr = matchCountsStage._phoneticMatches_0 as {
      $size: { $setIntersection: [string[], object] };
    };
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
      charPrefixWeight: 100,
      phoneticMatchWeight: 75,
    };

    expect(() => MongoAggregateRenderer.toMongoScore(scoreStage)).toThrow(
      'targetNameFields and targetTokenFields must have the same length',
    );
  });

  test('should throw when more than 2 target fields are provided', () => {
    const scoreStage: Score = {
      stage: 'SCORE',
      searchWords: ['mike'],
      nicknameWords: [],
      searchMetaphones: ['MK'],
      nicknameMetaphones: [],
      targetNameFields: ['a.name', 'b.name', 'c.name'],
      targetTokenFields: ['a.tokens', 'b.tokens', 'c.tokens'],
      outputField: 'matchScore',
      exactMatchWeight: 10000,
      nicknameMatchWeight: 1000,
      charPrefixWeight: 100,
      phoneticMatchWeight: 75,
    };

    expect(() => MongoAggregateRenderer.toMongoScore(scoreStage)).toThrow(
      'maxTargetIdx only supports 1-2 target fields',
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

    const matchCountsStage = result[1].$addFields;
    expect(matchCountsStage._similarLengthMatch_0).toHaveProperty('$cond');

    const scoresStage = result[2].$addFields;
    const scoreExpr = scoresStage._score_0 as { $add: object[] };
    const phoneticCondition = scoreExpr.$add[2] as { $cond: { if: { $or: object[] } } };
    const qualifiers = phoneticCondition.$cond.if.$or;

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

    const matchCountsStage = result[1].$addFields;
    const similarLengthExpr = matchCountsStage._similarLengthMatch_0 as {
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

    const outerMap = similarLengthExpr.$cond.if.$anyElementTrue.$map;
    const innerMapContainer = outerMap.in as { $anyElementTrue: { $map: object } };
    const innerMap = innerMapContainer.$anyElementTrue.$map as {
      in: { $lte: [object, object] };
    };
    const comparison = innerMap.in.$lte;

    const toleranceCond = comparison[1] as {
      $cond: { if: { $eq: [object, object] }; then: number; else: number };
    };
    expect(toleranceCond).toHaveProperty('$cond');

    const sizeClassCheck = toleranceCond.$cond.if as { $eq: [object, object] };
    expect(sizeClassCheck).toHaveProperty('$eq');
    expect(sizeClassCheck.$eq).toHaveLength(2);

    expect(toleranceCond.$cond.then).toBe(1);
    expect(toleranceCond.$cond.else).toBe(0);
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

    const parseWordsStage = result[0].$addFields;
    const wordsExpr = parseWordsStage._words_0 as {
      $reduce: { input: { $split: [object, string] }; in: { $concatArrays: object[] } };
    };

    expect(wordsExpr).toHaveProperty('$reduce');
    expect(wordsExpr.$reduce.input).toHaveProperty('$split');
    expect(wordsExpr.$reduce.in).toHaveProperty('$concatArrays');
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
    const stages = MongoAggregateRenderer.toMongoAggregate(query) as MongoScoreStage[];

    expect(stages).toHaveLength(8);
    const [
      matchStage,
      parseWordsStage,
      matchCountsStage,
      scoresStage,
      maxScoreStage,
      searchMetadataStage,
      cleanupStage,
      sortStageResult,
    ] = stages;

    expect(matchStage).toHaveProperty('$match');
    expect(parseWordsStage).toHaveProperty('$addFields');
    expect(matchCountsStage).toHaveProperty('$addFields');
    expect(scoresStage).toHaveProperty('$addFields');
    expect(maxScoreStage).toHaveProperty('$addFields');
    expect(searchMetadataStage).toHaveProperty('$addFields');
    expect(cleanupStage).toHaveProperty('$project');
    expect(sortStageResult).toHaveProperty('$sort');
  });

  describe('toMongoScore - searchMetadata computation', () => {
    // 2-target variant for tests that exercise multi-target scoring logic
    function make2TargetScoreStage(overrides: Partial<Parameters<typeof score>[0]> = {}): Score {
      return makeScoreStage({
        targetNameFields: ['debtor.name', 'jointDebtor.name'],
        targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
        ...overrides,
      });
    }

    test('should produce 6 stages total (adding searchMetadata stage between max and cleanup)', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      expect(result).toHaveLength(6);
    });

    test('should include a searchMetadata field in the pipeline', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      expect(() => getSearchMetadataStage(result)).not.toThrow();
    });

    test('should have searchMetadata.matchScore referencing the outputField', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      expect(stage.$addFields.searchMetadata.matchScore).toBe('$matchScore');
    });

    test('should have searchMetadata.primaryMatchType as a $cond expression selecting debtor vs joint debtor', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypes = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      expect(matchTypes.$cond.if).toEqual({
        $eq: [expect.objectContaining({ $cond: expect.any(Object) }), 0],
      });
    });

    test('should determine max target by comparing _score_0 >= _score_1 ($gte)', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const maxTargetIdx = primaryMatchType.$cond.if.$eq[0];
      expect(maxTargetIdx.$cond.if).toEqual({ $gte: ['$_score_0', '$_score_1'] });
      expect(maxTargetIdx.$cond.then).toBe(0);
      expect(maxTargetIdx.$cond.else).toBe(1);
    });

    test('should build primaryMatchType for debtor (idx 0) using $arrayElemAt with $map over $sortArray', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      expect(primaryMatchType.$cond.then).toHaveProperty('$arrayElemAt');
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      expect(arrayElem[0]).toHaveProperty('$map');
      expect(mapExpr.$map.input).toHaveProperty('$sortArray');
      expect(arrayElem[1]).toBe(0); // Get first element
    });

    test('should include exact match type in debtor primaryMatchType expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      const filterInput = mapExpr.$map.input.$sortArray.input.$filter.input;
      const exactItem = filterInput.find(
        (item: { type: string; score: object }) => item.type === 'exact',
      );
      expect(exactItem).toBeDefined();
      expect(exactItem.type).toBe('exact');
      expect(exactItem.score).toHaveProperty('$cond');
    });

    test('should include nickname match type in debtor primaryMatchType expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      const filterInput = mapExpr.$map.input.$sortArray.input.$filter.input;
      const nicknameItem = filterInput.find(
        (item: { type: string; score: object }) => item.type === 'nickname',
      );
      expect(nicknameItem).toBeDefined();
      expect(nicknameItem.type).toBe('nickname');
    });

    test('should include phonetic match type in debtor primaryMatchType expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      const filterInput = mapExpr.$map.input.$sortArray.input.$filter.input;
      const phoneticItem = filterInput.find(
        (item: { type: string; score: object }) => item.type === 'phonetic',
      );
      expect(phoneticItem).toBeDefined();
      expect(phoneticItem.type).toBe('phonetic');
      expect(phoneticItem.score.$cond.if).toHaveProperty('$and');
    });

    test('should include charPrefix match type in debtor primaryMatchType expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      const filterInput = mapExpr.$map.input.$sortArray.input.$filter.input;
      const charPrefixItem = filterInput.find(
        (item: { type: string; score: object }) => item.type === 'charPrefix',
      );
      expect(charPrefixItem).toBeDefined();
      expect(charPrefixItem.type).toBe('charPrefix');
    });

    test('should sort match types by score in descending order and return first element', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const thenExpr = primaryMatchType.$cond.then as MongoArrayElemAtExpr;
      const arrayElem = thenExpr.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      const sortBy = mapExpr.$map.input.$sortArray.sortBy;
      expect(sortBy).toEqual({ score: -1 });
      expect(arrayElem[1]).toBe(0); // Takes first (highest-scoring) element
    });

    test('should have searchMetadata.scoreBreakdown as a $cond expression', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      expect(stage.$addFields.searchMetadata.scoreBreakdown).toHaveProperty('$cond');
    });

    test('should use $arrayElemAt with $map over $sortArray directly (no $cond) for primaryMatchType with a single target', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        makeScoreStage({
          targetNameFields: ['debtor.name'],
          targetTokenFields: ['debtor.phoneticTokens'],
        }),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      expect(stage.$addFields.searchMetadata.primaryMatchType).toHaveProperty('$arrayElemAt');
      expect(stage.$addFields.searchMetadata.primaryMatchType).not.toHaveProperty('$cond');
      const primaryMatchType = stage.$addFields.searchMetadata
        .primaryMatchType as MongoArrayElemAtExpr;
      const arrayElem = primaryMatchType.$arrayElemAt;
      expect(arrayElem[0]).toHaveProperty('$map');
      expect(stage.$addFields.searchMetadata.scoreBreakdown).not.toHaveProperty('$cond');
      expect(stage.$addFields.searchMetadata.scoreBreakdown).toHaveProperty('exactScore');
    });

    test('should still clean up all temp fields in the final $project stage', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        make2TargetScoreStage(),
      ) as MongoScoreStage[];
      const cleanupStage = result[result.length - 1] as MongoScoreStage;
      expect(cleanupStage).toHaveProperty('$project');
      const projection = cleanupStage.$project as Record<string, number>;
      expect(projection['_words_0']).toBe(0);
      expect(projection['_exactMatches_0']).toBe(0);
      expect(projection['_score_0']).toBe(0);
    });
  });

  describe('score-based match type ordering', () => {
    function getMatchTypeArray(stage: MongoSearchMetadataStage) {
      // Extract the array of {type, score} objects that get sorted
      const primaryMatchType = stage.$addFields.searchMetadata
        .primaryMatchType as MongoArrayElemAtExpr;
      const arrayElem = primaryMatchType.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;
      return mapExpr.$map.input.$sortArray.input.$filter.input;
    }

    test('should define all four match types with correct weights', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const matchTypeArray = getMatchTypeArray(stage);

      const exactItem = matchTypeArray.find((item: { type: string }) => item.type === 'exact');
      const nicknameItem = matchTypeArray.find(
        (item: { type: string }) => item.type === 'nickname',
      );
      const charPrefixItem = matchTypeArray.find(
        (item: { type: string }) => item.type === 'charPrefix',
      );
      const phoneticItem = matchTypeArray.find(
        (item: { type: string }) => item.type === 'phonetic',
      );

      // All four types should be present
      expect(exactItem).toBeDefined();
      expect(nicknameItem).toBeDefined();
      expect(charPrefixItem).toBeDefined();
      expect(phoneticItem).toBeDefined();

      // Verify types match constants
      expect(exactItem.type).toBe('exact');
      expect(nicknameItem.type).toBe('nickname');
      expect(charPrefixItem.type).toBe('charPrefix');
      expect(phoneticItem.type).toBe('phonetic');
    });

    test('should sort match types by score descending to prioritize highest scorer', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata
        .primaryMatchType as MongoArrayElemAtExpr;
      const arrayElem = primaryMatchType.$arrayElemAt;
      const mapExpr = arrayElem[0] as MongoMapExpr;

      // Verify descending sort order (-1)
      expect(mapExpr.$map.input.$sortArray.sortBy).toEqual({ score: -1 });

      // Verify first element extraction (highest score)
      expect(arrayElem[1]).toBe(0);
    });

    test('should extract single primaryMatchType from sorted array', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const primaryMatchType = stage.$addFields.searchMetadata
        .primaryMatchType as MongoArrayElemAtExpr;

      // Should use $arrayElemAt to extract first element
      expect(primaryMatchType).toHaveProperty('$arrayElemAt');
      const arrayElem = primaryMatchType.$arrayElemAt;

      // Should extract element at index 0 (first/highest)
      expect(arrayElem[1]).toBe(0);

      // Should extract the 'type' field via $map
      const mapExpr = arrayElem[0] as MongoMapExpr;
      expect(mapExpr.$map.in).toBe('$$matchItem.type');
    });

    test('should produce scoreBreakdown with all four match type scores', () => {
      const result = MongoAggregateRenderer.toMongoScore(makeScoreStage()) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);
      const scoreBreakdown = stage.$addFields.searchMetadata.scoreBreakdown;

      // All four score fields should be present
      expect(scoreBreakdown).toHaveProperty('exactScore');
      expect(scoreBreakdown).toHaveProperty('nicknameScore');
      expect(scoreBreakdown).toHaveProperty('charPrefixScore');
      expect(scoreBreakdown).toHaveProperty('phoneticScore');
    });

    test('should handle single target field without $cond wrapper', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        makeScoreStage({
          targetNameFields: ['debtor.name'],
          targetTokenFields: ['debtor.phoneticTokens'],
        }),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);

      // Single target should not have $cond (no debtor vs jointDebtor choice)
      expect(stage.$addFields.searchMetadata.primaryMatchType).toHaveProperty('$arrayElemAt');
      expect(stage.$addFields.searchMetadata.primaryMatchType).not.toHaveProperty('$cond');
    });

    test('should handle multiple target fields with $cond to select max scorer', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        makeScoreStage({
          targetNameFields: ['debtor.name', 'jointDebtor.name'],
          targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
        }),
      ) as MongoScoreStage[];
      const stage = getSearchMetadataStage(result);

      // Multiple targets should have $cond to choose between debtor/jointDebtor
      expect(stage.$addFields.searchMetadata.primaryMatchType).toHaveProperty('$cond');
      const primaryMatchType = stage.$addFields.searchMetadata.primaryMatchType as MongoCondExpr;
      const cond = primaryMatchType.$cond;

      // Should compare scores to determine which target matched better
      expect(cond.if).toHaveProperty('$eq');
      expect(cond.then).toHaveProperty('$arrayElemAt');
      expect(cond.else).toHaveProperty('$arrayElemAt');
    });

    test('should strip apostrophes from name fields to normalize for exact matching', () => {
      const result = MongoAggregateRenderer.toMongoScore(
        makeScoreStage({
          searchWords: ['obrien'],
          targetNameFields: ['debtor.name'],
          targetTokenFields: ['debtor.phoneticTokens'],
        }),
      ) as MongoScoreStage[];

      // First stage should parse words and strip apostrophes
      const parseWordsStage = result[0];
      expect(parseWordsStage).toHaveProperty('$addFields');
      const wordsField = parseWordsStage.$addFields._words_0 as Record<string, unknown>;

      // Should have apostrophe stripping logic using $reduce + $split + $concat
      expect(wordsField).toHaveProperty('$reduce');
      const reduceInput = (wordsField.$reduce as Record<string, unknown>).input as Record<
        string,
        unknown
      >;
      expect(reduceInput).toHaveProperty('$split');

      // The split input should handle empty strings with $cond
      const splitSource = (reduceInput.$split as unknown[])[0] as Record<string, unknown>;
      expect(splitSource).toHaveProperty('$cond');

      // The else branch should use $reduce to strip apostrophes
      const apostropheStripping = (splitSource.$cond as Record<string, unknown>).else as Record<
        string,
        unknown
      >;
      expect(apostropheStripping).toHaveProperty('$reduce');
      const apostropheInput = (apostropheStripping.$reduce as Record<string, unknown>)
        .input as Record<string, unknown>;
      expect(apostropheInput).toHaveProperty('$split');
      // Should split on apostrophe
      const splitArray = apostropheInput.$split as unknown[];
      expect(splitArray[1]).toBe("'");
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
  joinType: 'INNER',
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
