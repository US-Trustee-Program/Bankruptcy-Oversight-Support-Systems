import QueryPipeline, {
  DEFAULT_BIGRAM_WEIGHT,
  DEFAULT_NICKNAME_WEIGHT,
  DEFAULT_PHONETIC_WEIGHT,
  Score,
  Stage,
} from '../../../../query/query-pipeline';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { Condition, Field } from '../../../../query/query-builder';
import { CaseAssignment } from '@common/cams/assignments';

type MongoAddFieldsValue = {
  $size?: { $setIntersection: [string[], string] };
  $max?: string[];
  $add?: unknown[];
};
type MongoScoreStage = {
  $addFields?: Record<string, MongoAddFieldsValue>;
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
    const searchTokens = ['jo', 'hn', 'JN', 'J500'];
    const nicknameTokens = ['mi', 'MK'];
    const scoreStage: Score = score(
      searchTokens,
      nicknameTokens,
      ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    expect(result).toHaveLength(3);

    expect(result[0]).toHaveProperty('$addFields');
    expect(result[0].$addFields).toHaveProperty('_bigramMatches_0');
    expect(result[0].$addFields).toHaveProperty('_phoneticMatches_0');
    expect(result[0].$addFields).toHaveProperty('_nicknameMatches_0');
    expect(result[0].$addFields).toHaveProperty('_nicknamePhoneticMatches_0');
    expect(result[0].$addFields).toHaveProperty('_coverageBonus_0');
    expect(result[0].$addFields).toHaveProperty('_score_0');
    expect(result[0].$addFields).toHaveProperty('_bigramMatches_1');
    expect(result[0].$addFields).toHaveProperty('_phoneticMatches_1');
    expect(result[0].$addFields).toHaveProperty('_nicknameMatches_1');
    expect(result[0].$addFields).toHaveProperty('_nicknamePhoneticMatches_1');
    expect(result[0].$addFields).toHaveProperty('_coverageBonus_1');
    expect(result[0].$addFields).toHaveProperty('_score_1');

    expect(result[1]).toHaveProperty('$addFields');
    expect(result[1].$addFields).toHaveProperty('matchScore');
    expect(result[1].$addFields).toHaveProperty('bigramMatchCount');
    expect(result[1].$addFields).toHaveProperty('phoneticMatchCount');
    expect(result[1].$addFields).toHaveProperty('nicknameMatchCount');
    expect(result[1].$addFields).toHaveProperty('nicknamePhoneticMatchCount');

    expect(result[2]).toHaveProperty('$project');
    expect(result[2].$project).toEqual({
      _bigramMatches_0: 0,
      _phoneticMatches_0: 0,
      _nicknameMatches_0: 0,
      _nicknamePhoneticMatches_0: 0,
      _coverageBonus_0: 0,
      _score_0: 0,
      _bigramMatches_1: 0,
      _phoneticMatches_1: 0,
      _nicknameMatches_1: 0,
      _nicknamePhoneticMatches_1: 0,
      _coverageBonus_1: 0,
      _score_1: 0,
    });
  });

  test('should render SCORE stage with correct $setIntersection for bigrams, phonetics, and nicknames', () => {
    const searchTokens = ['jo', 'hn', 'JN', 'J500'];
    const nicknameTokens = ['mi', 'MK'];
    const scoreStage: Score = score(
      searchTokens,
      nicknameTokens,
      ['debtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    const addFieldsStage = result[0].$addFields;

    expect(addFieldsStage._bigramMatches_0.$size.$setIntersection[0]).toEqual(['jo', 'hn']);
    expect(addFieldsStage._phoneticMatches_0.$size.$setIntersection[0]).toEqual(['JN', 'J500']);
    expect(addFieldsStage._nicknameMatches_0.$size.$setIntersection[0]).toEqual(['mi', 'MK']);
  });

  test('should separate bigrams so "John" query does not match "Jane" bigrams', () => {
    const johnQueryTokens = ['jo', 'oh', 'hn', 'J500', 'JN'];
    const janeDocTokens = ['ja', 'an', 'ne', 'J500', 'JN'];

    const scoreStage: Score = score(
      johnQueryTokens,
      [],
      ['debtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];
    const addFieldsStage = result[0].$addFields;

    const queryBigrams = addFieldsStage._bigramMatches_0.$size.$setIntersection[0];
    const janeBigrams = janeDocTokens.filter((t) => t === t.toLowerCase() && t.length === 2);

    const bigramOverlap = queryBigrams.filter((b: string) => janeBigrams.includes(b));
    expect(bigramOverlap).toHaveLength(0);

    const queryPhonetics = addFieldsStage._phoneticMatches_0.$size.$setIntersection[0];
    const janePhonetics = janeDocTokens.filter((t) => /^[A-Z0-9]+$/.test(t) && t.length > 1);

    const phoneticOverlap = queryPhonetics.filter((p: string) => janePhonetics.includes(p));
    expect(phoneticOverlap.length).toBeGreaterThan(0);
  });

  test('should allow nickname matches: "Mike" query matches "Michael" via shared bigrams', () => {
    const mikeQueryTokens = ['mi', 'ik', 'ke', 'M200', 'MK'];
    const michaelDocTokens = ['mi', 'ic', 'ch', 'ha', 'ae', 'el', 'M240', 'MXL'];

    const scoreStage: Score = score(
      mikeQueryTokens,
      [],
      ['debtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];
    const addFieldsStage = result[0].$addFields;

    const queryBigrams = addFieldsStage._bigramMatches_0.$size.$setIntersection[0];
    const michaelBigrams = michaelDocTokens.filter((t) => t === t.toLowerCase() && t.length === 2);

    const bigramOverlap = queryBigrams.filter((b: string) => michaelBigrams.includes(b));
    expect(bigramOverlap.length).toBeGreaterThan(0);
    expect(bigramOverlap).toContain('mi');
  });

  test('should output match counts for filtering results', () => {
    const searchTokens = ['jo', 'hn', 'JN', 'J500'];
    const scoreStage: Score = score(
      searchTokens,
      [],
      ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];

    const maxScoreStage = result[1].$addFields;
    expect(maxScoreStage).toHaveProperty('bigramMatchCount');
    expect(maxScoreStage.bigramMatchCount).toEqual({
      $max: ['$_bigramMatches_0', '$_bigramMatches_1'],
    });
    expect(maxScoreStage).toHaveProperty('phoneticMatchCount');
    expect(maxScoreStage.phoneticMatchCount).toEqual({
      $max: ['$_phoneticMatches_0', '$_phoneticMatches_1'],
    });
    expect(maxScoreStage).toHaveProperty('nicknameMatchCount');
    expect(maxScoreStage.nicknameMatchCount).toEqual({
      $max: ['$_nicknameMatches_0', '$_nicknameMatches_1'],
    });
    expect(maxScoreStage).toHaveProperty('nicknamePhoneticMatchCount');
    expect(maxScoreStage.nicknamePhoneticMatchCount).toEqual({
      $max: ['$_nicknamePhoneticMatches_0', '$_nicknamePhoneticMatches_1'],
    });
  });

  test('should compute coverage bonus based on percentage of query tokens matched', () => {
    const searchTokens = ['mi', 'ik', 'ke', 'M200', 'MK']; // 5 tokens for "Mike"
    const nicknameTokens = ['ic', 'ch', 'ha', 'ae', 'el', 'M240', 'MKSHL']; // 7 tokens for "Michael"
    const scoreStage: Score = score(
      searchTokens,
      nicknameTokens,
      ['debtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const result = MongoAggregateRenderer.toMongoScore(scoreStage) as MongoScoreStage[];
    const addFieldsStage = result[0].$addFields;

    // Coverage bonus should be: (bigramMatches + phoneticMatches + nicknameMatches) / totalTokens * 20
    expect(addFieldsStage._coverageBonus_0).toHaveProperty('$multiply');
    const multiply = (addFieldsStage._coverageBonus_0 as { $multiply: unknown[] }).$multiply;
    expect(multiply).toHaveLength(2);

    // First element should be the division (coverage calculation)
    expect(multiply[0]).toHaveProperty('$divide');
    const divide = multiply[0].$divide;
    expect(divide).toHaveLength(2);

    // Total tokens should be searchTokens.length + nicknameTokens.length = 5 + 7 = 12
    expect(divide[1]).toBe(12);

    // Second element should be the multiplier (20 points max)
    expect(multiply[1]).toBe(20);
  });

  test('should flatten SCORE stages in pipeline', () => {
    const simpleMatch: Stage = {
      stage: 'MATCH',
      condition: 'EQUALS',
      leftOperand: { name: 'documentType' },
      rightOperand: 'SYNCED_CASE',
    };

    const scoreStage: Score = score(
      ['jo', 'JN'],
      [],
      ['debtor.phoneticTokens'],
      'matchScore',
      DEFAULT_BIGRAM_WEIGHT,
      DEFAULT_PHONETIC_WEIGHT,
      DEFAULT_NICKNAME_WEIGHT,
    );

    const sortStage: Stage = {
      stage: 'SORT',
      fields: [{ field: { name: 'matchScore' }, direction: 'DESCENDING' }],
    };

    const query = pipeline(simpleMatch, scoreStage, sortStage);
    const result = MongoAggregateRenderer.toMongoAggregate(query);

    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty('$match');
    expect(result[1]).toHaveProperty('$addFields');
    expect(result[2]).toHaveProperty('$addFields');
    expect(result[3]).toHaveProperty('$project');
    expect(result[4]).toHaveProperty('$sort');
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
