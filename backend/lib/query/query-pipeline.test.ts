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
  addFields,
  additionalField,
  ascending,
  count,
  descending,
  exclude,
  first,
  join,
  match,
  paginate,
  pipeline,
  sort,
  source,
} = QueryPipeline;

describe('Query Pipeline', () => {
  type Foo = {
    three: boolean;
    two: number;
    uno: string;
  };

  type Bar = {
    five: boolean;
    four: number;
    uno: string;
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

    expect(sort(attributeFoo)).toEqual({ fields: [attributeFoo], stage: 'SORT' });
    expect(sort(attributeFoo, attributeBar)).toEqual({
      fields: [attributeFoo, attributeBar],
      stage: 'SORT',
    });
  });

  test('should proxy a Join stage', () => {
    const expected = {
      alias: expect.objectContaining({
        name: 'barDocs',
      }),
      foreign: expect.objectContaining({
        name: 'uno',
        source: 'barCollection',
      }),
      local: expect.objectContaining({
        name: 'uno',
        source: 'fooCollection',
      }),
      stage: 'JOIN',
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
      fields: [
        {
          fieldToAdd: expect.objectContaining({ name: 'matchingBars' }),
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
          querySource: expect.objectContaining({ name: 'barDocs' }),
        },
      ],
      stage: 'ADD_FIELDS',
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
      fields: [
        expect.objectContaining({ name: 'four' }),
        expect.objectContaining({ name: 'five' }),
      ],
      stage: 'EXCLUDE',
    };

    const barCollection = source<Bar>();
    const fourField = barCollection.field('four');
    const fiveField = barCollection.field('five');

    const actual = exclude(fourField, fiveField);

    expect(actual).toEqual(expected);
  });

  test('should proxy a Paginate stage', () => {
    const expected = {
      limit: 5,
      skip: 0,
      stage: 'PAGINATE',
    };

    const actual = paginate(0, 5);

    expect(actual).toEqual(expected);
  });

  test('should proxy a Match stage', () => {
    const expected = {
      conjunction: 'AND',
      stage: 'MATCH',
      values: [],
    };

    const actual = match({
      conjunction: 'AND',
      values: [],
    });

    expect(actual).toEqual(expected);
  });

  test('should coalesce Stage args into a Pipeline', () => {
    const stageOne: Stage = {
      limit: 5,
      skip: 0,
      stage: 'PAGINATE',
    };
    const stageTwo: Stage = {
      fields: [{ name: 'four' }, { name: 'five' }],
      stage: 'EXCLUDE',
    };

    const expected = {
      stages: [stageOne, stageTwo],
    };

    const actual = pipeline(stageOne, stageTwo);

    expect(actual).toEqual(expected);
  });

  test('isSort', () => {
    const sort: Sort = {
      fields: [{ direction: 'ASCENDING', field: { name: 'uno' } }],
      stage: 'SORT',
    };
    expect(isSort(sort)).toBeTruthy();
    expect(isSort({})).toBeFalsy();
  });

  test('isPaginate', () => {
    const paginate: Paginate = {
      limit: 100,
      skip: 0,
      stage: 'PAGINATE',
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
});
