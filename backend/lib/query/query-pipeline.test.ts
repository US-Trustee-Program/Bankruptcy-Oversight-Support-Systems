import { describe, test, expect, beforeEach } from 'vitest';
import { Condition, using } from './query-builder';
import QueryPipeline, {
  buildPhoneticScore,
  DEFAULT_CHAR_PREFIX_WEIGHT,
  DEFAULT_EXACT_MATCH_WEIGHT,
  DEFAULT_NICKNAME_MATCH_WEIGHT,
  DEFAULT_PHONETIC_MATCH_WEIGHT,
  FieldReference,
  isPaginate,
  isPipeline,
  isSort,
  Paginate,
  Sort,
  Stage,
} from './query-pipeline';

const {
  addFields,
  additionalField,
  alias,
  ascending,
  count,
  descending,
  exclude,
  first,
  group,
  include,
  join,
  match,
  omit,
  paginate,
  pick,
  pipeline,
  project,
  push,
  score,
  sort,
  source,
} = QueryPipeline;

describe('Query Pipeline', () => {
  type Foo = {
    uno: string;
    two: number;
    three: boolean;
  };

  type Bar = {
    uno: string;
    four: number;
    five: boolean;
  };

  type FooExtension = Foo & {
    barDocs: Bar[];
    matchingBars: Bar[];
  };

  beforeEach(() => {
    // No mocks in this file — present for convention compliance
  });

  // ---------------------------------------------------------------------------
  // source()
  // ---------------------------------------------------------------------------

  describe('source', () => {
    test('should return a field function that generates QueryFieldReference', () => {
      const collectionName = 'collection';
      const s = source<Foo>(collectionName);

      expect(s.name).toEqual(collectionName);
      expect(s.field('uno')).toEqual(
        expect.objectContaining({
          name: 'uno',
          source: collectionName,
        }),
      );
    });

    test('should return a fields function that generates a Record<keyof T, QueryFieldReference>', () => {
      const collectionName = 'coll';
      const s = source<Foo>(collectionName);
      const [uno, _] = s.fields('uno', 'two');

      expect(uno.source).toEqual(collectionName);

      const keys = [
        'equals',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'notEqual',
        'exists',
        'notExists',
        'contains',
        'notContains',
        'regex',
      ];
      keys.forEach((key) => {
        expect(key in uno).toBeTruthy();
      });

      const q = using<Foo>();
      const comparisions = [
        [uno.equals('test'), q('uno').equals('test')],
        [uno.greaterThan('test'), q('uno').greaterThan('test')],
        [uno.greaterThanOrEqual('test'), q('uno').greaterThanOrEqual('test')],
        [uno.lessThan('test'), q('uno').lessThan('test')],
        [uno.lessThanOrEqual('test'), q('uno').lessThanOrEqual('test')],
        [uno.notEqual('test'), q('uno').notEqual('test')],
        [uno.exists(), q('uno').exists()],
        [uno.notExists(), q('uno').notExists()],
        [uno.contains('test'), q('uno').contains('test')],
        [uno.notContains('test'), q('uno').notContains('test')],
        [uno.regex('test'), q('uno').regex('test')],
      ];
      comparisions.forEach((comparision) => {
        const [actual, expected] = comparision;
        expect(actual).toEqual(expected);
      });
    });

    test('should not set source when no collection name is provided', () => {
      const s = source<Foo>();
      expect(s.name).toBeUndefined();
      expect(s.field('uno').source).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // sort / ascending / descending
  // ---------------------------------------------------------------------------

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const fooCollection = source<Foo>('fooCollection');
    const barCollection = source<Bar>('barCollection');

    const attributeFoo = ascending(fooCollection.field('uno'));
    const attributeBar = descending(barCollection.field('four'));

    expect(sort(attributeFoo)).toEqual({ stage: 'SORT', fields: [attributeFoo] });
    expect(sort(attributeFoo, attributeBar)).toEqual({
      stage: 'SORT',
      fields: [attributeFoo, attributeBar],
    });
  });

  // ---------------------------------------------------------------------------
  // join() — intent functions
  // ---------------------------------------------------------------------------

  test('should proxy a Join stage with INNER joinType by default', () => {
    const expected = expect.objectContaining({
      stage: 'JOIN',
      joinType: 'INNER',
      local: expect.objectContaining({ name: 'uno', source: 'fooCollection' }),
      foreign: expect.objectContaining({ name: 'uno', source: 'barCollection' }),
      alias: expect.objectContaining({ name: 'barDocs' }),
    });

    const fooCollection = source<Foo>('fooCollection');
    const barCollection = source<Bar>('barCollection');
    const extension = source<FooExtension>();

    const actual = join(barCollection.field('uno'))
      .onto(fooCollection.field('uno'))
      .as(extension.field('barDocs'));
    expect(actual).toEqual(expected);

    expect(actual.inner().joinType).toBe('INNER');
    expect(actual.leftOuter().joinType).toBe('LEFT_OUTER');
  });

  // ---------------------------------------------------------------------------
  // addFields
  // ---------------------------------------------------------------------------

  test('should proxy an AddFields stage', () => {
    const expected = {
      stage: 'ADD_FIELDS',
      fields: [
        {
          fieldToAdd: expect.objectContaining({ name: 'matchingBars' }),
          querySource: expect.objectContaining({ name: 'barDocs' }),
          query: {
            conjunction: 'AND',
            values: [
              {
                condition: 'EXISTS',
                leftOperand: expect.objectContaining({ name: 'uno', source: 'fooCollection' }),
                rightOperand: false,
              },
            ],
          },
        },
      ],
    };

    const matchingBars: FieldReference<FooExtension> = { name: 'matchingBars' };
    const additionalDocs: FieldReference<FooExtension> = { name: 'barDocs' };
    const fooCollection = source<Foo>('fooCollection');
    const ifNullField = fooCollection.field('uno');
    const query: Condition<Foo> = {
      condition: 'EXISTS',
      leftOperand: ifNullField,
      rightOperand: false,
    };

    const actual = addFields(
      additionalField(matchingBars, additionalDocs, { conjunction: 'AND', values: [query] }),
    );

    expect(actual).toEqual(expected);
  });

  // ---------------------------------------------------------------------------
  // exclude / include
  // ---------------------------------------------------------------------------

  test('should proxy an Exclude stage', () => {
    const expected = {
      stage: 'EXCLUDE',
      fields: [
        expect.objectContaining({ name: 'four' }),
        expect.objectContaining({ name: 'five' }),
      ],
    };
    const barCollection = source<Bar>();
    expect(exclude(barCollection.field('four'), barCollection.field('five'))).toEqual(expected);
  });

  test('should proxy an Include stage', () => {
    const actual = include({ name: 'uno' }, { name: 'two' });
    expect(actual).toEqual({ stage: 'INCLUDE', fields: [{ name: 'uno' }, { name: 'two' }] });
  });

  // ---------------------------------------------------------------------------
  // project / pick / omit / alias
  // ---------------------------------------------------------------------------

  test('should proxy a Project stage with pick, omit, and alias mappings', () => {
    const actual = project(pick('caseId'), omit('_id'), alias('trusteeId', '_joined.trusteeId'));
    expect(actual).toEqual({
      stage: 'PROJECT',
      mappings: [
        { to: 'caseId' },
        { to: '_id', exclude: true },
        { to: 'trusteeId', from: '_joined.trusteeId' },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // paginate / match / pipeline
  // ---------------------------------------------------------------------------

  test('should proxy a Paginate stage', () => {
    expect(paginate(0, 5)).toEqual({ stage: 'PAGINATE', skip: 0, limit: 5 });
  });

  test('should proxy a Match stage', () => {
    expect(match({ conjunction: 'AND', values: [] })).toEqual({
      conjunction: 'AND',
      values: [],
      stage: 'MATCH',
    });
  });

  test('should coalesce Stage args into a Pipeline', () => {
    const stageOne: Stage = { stage: 'PAGINATE', skip: 0, limit: 5 };
    const stageTwo: Stage = { stage: 'EXCLUDE', fields: [{ name: 'four' }, { name: 'five' }] };
    expect(pipeline(stageOne, stageTwo)).toEqual({ stages: [stageOne, stageTwo] });
  });

  // ---------------------------------------------------------------------------
  // isSort — type guard
  // ---------------------------------------------------------------------------

  describe('isSort', () => {
    test('should return true for a Sort stage', () => {
      const sort: Sort = {
        stage: 'SORT',
        fields: [{ field: { name: 'uno' }, direction: 'ASCENDING' }],
      };
      expect(isSort(sort)).toBe(true);
    });

    test('should return false for non-Sort objects', () => {
      expect(isSort({})).toBe(false);
      expect(isSort({ stage: 'MATCH' })).toBe(false);
    });

    test('should return false for null and primitives without throwing', () => {
      expect(isSort(null)).toBe(false);
      expect(isSort(undefined)).toBe(false);
      expect(isSort('SORT')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isPaginate — type guard
  // ---------------------------------------------------------------------------

  describe('isPaginate', () => {
    test('should return true for a Paginate stage', () => {
      const p: Paginate = { stage: 'PAGINATE', limit: 100, skip: 0 };
      expect(isPaginate(p)).toBe(true);
    });

    test('should return false for non-Paginate objects', () => {
      expect(isPaginate({ foo: 'bar' })).toBe(false);
      expect(isPaginate({})).toBe(false);
    });

    test('should return false for null and primitives without throwing', () => {
      expect(isPaginate(null)).toBe(false);
      expect(isPaginate(undefined)).toBe(false);
      expect(isPaginate(42)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isPipeline — type guard
  // ---------------------------------------------------------------------------

  describe('isPipeline', () => {
    test('should return true for a Pipeline object', () => {
      expect(isPipeline({ stages: [] })).toBe(true);
    });

    test('should return false for non-Pipeline objects', () => {
      expect(isPipeline({})).toBe(false);
      expect(isPipeline({ stage: 'MATCH' })).toBe(false);
    });

    test('should return false for null and primitives without throwing', () => {
      expect(isPipeline(null)).toBe(false);
      expect(isPipeline(undefined)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // accumulators — count, first, push, group
  // ---------------------------------------------------------------------------

  describe('accumulators', () => {
    test('should create a count accumulator', () => {
      expect(count({ name: 'total' })).toEqual({ accumulator: 'COUNT', as: { name: 'total' } });
    });

    test('should create a first accumulator', () => {
      expect(first({ name: 'value' }, { name: 'firstValue' })).toEqual({
        accumulator: 'FIRST',
        as: { name: 'firstValue' },
        field: { name: 'value' },
      });
    });

    test('should create a push accumulator', () => {
      expect(push({ name: 'item' }, { name: 'items' })).toEqual({
        accumulator: 'PUSH',
        as: { name: 'items' },
        field: { name: 'item' },
      });
    });

    test('should create a Group stage', () => {
      const actual = group([{ name: 'chapter' }], [count({ name: 'total' })]);
      expect(actual).toEqual({
        stage: 'GROUP',
        groupBy: [{ name: 'chapter' }],
        accumulators: [{ accumulator: 'COUNT', as: { name: 'total' } }],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // score / buildPhoneticScore
  // ---------------------------------------------------------------------------

  describe('score', () => {
    test('should create a score stage with all parameters', () => {
      const expected = {
        stage: 'SCORE',
        searchWords: ['john'],
        nicknameWords: ['jonathan', 'jon'],
        searchMetaphones: ['JN'],
        nicknameMetaphones: ['JN0N'],
        targetNameFields: ['debtor.name', 'jointDebtor.name'],
        targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
        outputField: 'matchScore',
        exactMatchWeight: 5000,
        nicknameMatchWeight: 500,
        phoneticMatchWeight: 50,
        charPrefixWeight: 25,
      };
      expect(
        score({
          searchWords: ['john'],
          nicknameWords: ['jonathan', 'jon'],
          searchMetaphones: ['JN'],
          nicknameMetaphones: ['JN0N'],
          targetNameFields: ['debtor.name', 'jointDebtor.name'],
          targetTokenFields: ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'],
          outputField: 'matchScore',
          exactMatchWeight: 5000,
          nicknameMatchWeight: 500,
          phoneticMatchWeight: 50,
          charPrefixWeight: 25,
        }),
      ).toEqual(expected);
    });

    test('should use default weights when not provided', () => {
      const actual = score({
        searchWords: ['john'],
        nicknameWords: [],
        searchMetaphones: ['JN'],
        nicknameMetaphones: [],
        targetNameFields: ['debtor.name'],
        targetTokenFields: ['debtor.phoneticTokens'],
        outputField: 'matchScore',
      });
      expect(actual.exactMatchWeight).toEqual(DEFAULT_EXACT_MATCH_WEIGHT);
      expect(actual.nicknameMatchWeight).toEqual(DEFAULT_NICKNAME_MATCH_WEIGHT);
      expect(actual.phoneticMatchWeight).toEqual(DEFAULT_PHONETIC_MATCH_WEIGHT);
      expect(actual.charPrefixWeight).toEqual(DEFAULT_CHAR_PREFIX_WEIGHT);
    });

    test('buildPhoneticScore should delegate to score with correct shape', () => {
      const params = {
        searchWords: ['john'],
        nicknameWords: ['jon'],
        searchMetaphones: ['JN'],
        nicknameMetaphones: ['JN'],
      };
      const actual = buildPhoneticScore(params, ['debtor.name'], ['debtor.phoneticTokens']);
      expect(actual.stage).toBe('SCORE');
      expect(actual.targetNameFields).toEqual(['debtor.name']);
      expect(actual.targetTokenFields).toEqual(['debtor.phoneticTokens']);
      expect(actual.outputField).toBe('matchScore');
      expect(actual.exactMatchWeight).toBe(DEFAULT_EXACT_MATCH_WEIGHT);
    });

    test('buildPhoneticScore should accept a custom outputField', () => {
      const params = {
        searchWords: [],
        nicknameWords: [],
        searchMetaphones: [],
        nicknameMetaphones: [],
      };
      const actual = buildPhoneticScore(params, ['name'], ['tokens'], 'customScore');
      expect(actual.outputField).toBe('customScore');
    });
  });
});
