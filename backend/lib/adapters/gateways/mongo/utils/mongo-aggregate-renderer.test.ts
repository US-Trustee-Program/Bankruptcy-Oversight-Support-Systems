import QueryPipeline, { Score, Stage } from '../../../../query/query-pipeline';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { Condition, Field } from '../../../../query/query-builder';
import { CaseAssignment } from '@common/cams/assignments';

type MongoScoreStage = {
  $addFields?: Record<string, unknown>;
  $project?: Record<string, number>;
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
      { $group: { _id: '$userId', name: { $first: '$name' }, total: { $count: {} } } },
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

    // 5 stages: parse words, match counts, scores, max score, cleanup
    expect(result).toHaveLength(5);

    // Stage 1: parse words expressions
    expect(result[0]).toHaveProperty('$addFields');
    expect(result[0].$addFields).toHaveProperty('_words_0');
    expect(result[0].$addFields).toHaveProperty('_words_1');

    // Stage 2: match count expressions
    expect(result[1]).toHaveProperty('$addFields');
    expect(result[1].$addFields).toHaveProperty('_exactMatches_0');
    expect(result[1].$addFields).toHaveProperty('_nicknameMatches_0');
    expect(result[1].$addFields).toHaveProperty('_phoneticMatches_0');
    expect(result[1].$addFields).toHaveProperty('_charPrefixMatch_0');
    expect(result[1].$addFields).toHaveProperty('_exactMatches_1');
    expect(result[1].$addFields).toHaveProperty('_nicknameMatches_1');
    expect(result[1].$addFields).toHaveProperty('_phoneticMatches_1');
    expect(result[1].$addFields).toHaveProperty('_charPrefixMatch_1');

    // Stage 3: score expressions
    expect(result[2]).toHaveProperty('$addFields');
    expect(result[2].$addFields).toHaveProperty('_score_0');
    expect(result[2].$addFields).toHaveProperty('_score_1');

    // Stage 4: max score
    expect(result[3]).toHaveProperty('$addFields');
    expect(result[3].$addFields).toHaveProperty('matchScore');

    // Stage 5: cleanup
    expect(result[4]).toHaveProperty('$project');
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

    // Stage 1 should parse name into words
    const parseStage = result[0].$addFields;
    expect(parseStage._words_0).toHaveProperty('$map');

    // Stage 2 should have exact, nickname, and phonetic match counts
    const matchCountStage = result[1].$addFields;
    expect(matchCountStage._exactMatches_0).toHaveProperty('$size');
    expect(matchCountStage._nicknameMatches_0).toHaveProperty('$size');
    expect(matchCountStage._phoneticMatches_0).toHaveProperty('$size');
    expect(matchCountStage._charPrefixMatch_0).toHaveProperty('$cond');
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
      $size: { $setIntersection: unknown[] };
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
      $size: { $setIntersection: unknown[] };
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
      $size: { $setIntersection: unknown[] };
    };
    // First element should contain both search and nickname metaphones
    const metaphones = phoneticMatchExpr.$size.$setIntersection[0] as string[];
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

    // 7 stages: 1 match + 5 score stages (parse, match counts, scores, max, cleanup) + 1 sort
    expect(result).toHaveLength(7);
    expect(result[0]).toHaveProperty('$match');
    expect(result[1]).toHaveProperty('$addFields'); // parse words
    expect(result[2]).toHaveProperty('$addFields'); // match counts
    expect(result[3]).toHaveProperty('$addFields'); // scores
    expect(result[4]).toHaveProperty('$addFields'); // max score
    expect(result[5]).toHaveProperty('$project'); // cleanup
    expect(result[6]).toHaveProperty('$sort');
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
