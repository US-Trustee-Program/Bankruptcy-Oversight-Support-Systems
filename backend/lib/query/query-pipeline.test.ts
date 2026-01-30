import { Condition, using } from './query-builder';
import QueryPipeline, {
  FieldReference,
  isPaginate,
  isSort,
  Paginate,
  Sort,
  Stage,
} from './query-pipeline';

const {
  pipeline,
  paginate,
  match,
  sort,
  ascending,
  descending,
  exclude,
  join,
  source,
  addFields,
  additionalField,
  count,
  first,
  score,
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
  });

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

  test('should proxy a Join stage', () => {
    const expected = {
      stage: 'JOIN',
      local: expect.objectContaining({
        name: 'uno',
        source: 'fooCollection',
      }),
      foreign: expect.objectContaining({
        name: 'uno',
        source: 'barCollection',
      }),
      alias: expect.objectContaining({
        name: 'barDocs',
      }),
    };

    const fooCollection = source<Foo>('fooCollection');
    const barCollection = source<Bar>('barCollection');
    const extension = source<FooExtension>();

    const fooKey = fooCollection.field('uno');
    const barKey = barCollection.field('uno');
    const additionalDocs = extension.field('barDocs');

    const actual = join(barKey).onto(fooKey).as(additionalDocs);

    expect(actual).toEqual(expected);
  });

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
                leftOperand: expect.objectContaining({
                  name: 'uno',
                  source: 'fooCollection',
                }),
                rightOperand: false,
              },
            ],
          },
        },
      ],
    };

    const matchingBars: FieldReference<FooExtension> = {
      name: 'matchingBars',
    };
    const additionalDocs: FieldReference<FooExtension> = {
      name: 'barDocs',
    };

    const fooCollection = source<Foo>('fooCollection');
    const ifNullField = fooCollection.field('uno');
    const query: Condition<Foo> = {
      condition: 'EXISTS',
      leftOperand: ifNullField,
      rightOperand: false,
    };

    const actual = addFields(
      additionalField(matchingBars, additionalDocs, {
        conjunction: 'AND',
        values: [query],
      }),
    );

    expect(actual).toEqual(expected);
  });

  test('should proxy an Exclude stage', () => {
    const expected = {
      stage: 'EXCLUDE',
      fields: [
        expect.objectContaining({ name: 'four' }),
        expect.objectContaining({ name: 'five' }),
      ],
    };

    const barCollection = source<Bar>();
    const fourField = barCollection.field('four');
    const fiveField = barCollection.field('five');

    const actual = exclude(fourField, fiveField);

    expect(actual).toEqual(expected);
  });

  test('should proxy a Paginate stage', () => {
    const expected = {
      stage: 'PAGINATE',
      skip: 0,
      limit: 5,
    };

    const actual = paginate(0, 5);

    expect(actual).toEqual(expected);
  });

  test('should proxy a Match stage', () => {
    const expected = {
      conjunction: 'AND',
      values: [],
      stage: 'MATCH',
    };

    const actual = match({
      conjunction: 'AND',
      values: [],
    });

    expect(actual).toEqual(expected);
  });

  test('should coalesce Stage args into a Pipeline', () => {
    const stageOne: Stage = {
      stage: 'PAGINATE',
      skip: 0,
      limit: 5,
    };
    const stageTwo: Stage = {
      stage: 'EXCLUDE',
      fields: [{ name: 'four' }, { name: 'five' }],
    };

    const expected = {
      stages: [stageOne, stageTwo],
    };

    const actual = pipeline(stageOne, stageTwo);

    expect(actual).toEqual(expected);
  });

  test('isSort', () => {
    const sort: Sort = {
      stage: 'SORT',
      fields: [{ field: { name: 'uno' }, direction: 'ASCENDING' }],
    };
    expect(isSort(sort)).toBeTruthy();
    expect(isSort({})).toBeFalsy();
  });

  test('isPaginate', () => {
    const paginate: Paginate = {
      stage: 'PAGINATE',
      limit: 100,
      skip: 0,
    };
    expect(isPaginate(paginate)).toBeTruthy();
    const notPagination = {
      foo: 'bar',
    };
    expect(isPaginate(notPagination)).toBeFalsy();
  });

  describe('accumulators', () => {
    test('should create a count accumulator', () => {
      const field = { name: 'total' };
      const expected = {
        accumulator: 'COUNT',
        as: { name: 'total' },
      };

      const actual = count(field);

      expect(actual).toEqual(expected);
    });

    test('should create a first accumulator', () => {
      const field = { name: 'value' };
      const as = { name: 'firstValue' };
      const expected = {
        accumulator: 'FIRST',
        as: { name: 'firstValue' },
        field: { name: 'value' },
      };

      const actual = first(field, as);

      expect(actual).toEqual(expected);
    });
  });

  describe('score', () => {
    test('should create a score stage with all parameters', () => {
      const searchTokens = ['jo', 'hn', 'JN', 'J500'];
      const targetFields = ['debtor.phoneticTokens', 'jointDebtor.phoneticTokens'];
      const outputField = 'matchScore';
      const bigramWeight = 3;
      const phoneticWeight = 10;

      const expected = {
        stage: 'SCORE',
        searchTokens,
        targetFields,
        outputField,
        bigramWeight,
        phoneticWeight,
      };

      const actual = score(searchTokens, targetFields, outputField, bigramWeight, phoneticWeight);

      expect(actual).toEqual(expected);
    });

    test('should use default weights when not provided', () => {
      const searchTokens = ['jo', 'JN'];
      const targetFields = ['debtor.phoneticTokens'];
      const outputField = 'matchScore';

      const actual = score(searchTokens, targetFields, outputField);

      expect(actual.bigramWeight).toEqual(3);
      expect(actual.phoneticWeight).toEqual(10);
    });
  });
});
