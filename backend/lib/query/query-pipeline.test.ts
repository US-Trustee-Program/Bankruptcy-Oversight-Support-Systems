import QueryPipeline, {
  FieldReference,
  FilterCondition,
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
  addFields,
  additionalField,
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
      local: {
        name: 'uno',
        source: 'fooCollection',
      },
      foreign: {
        name: 'uno',
        source: 'barCollection',
      },
      alias: {
        name: 'barDocs',
      },
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
          field: { name: 'matchingBars' },
          source: { name: 'barDocs' },
          query: {
            conjunction: 'AND',
            values: [
              {
                condition: 'EQUALS',
                leftOperand: {
                  condition: 'IF_NULL',
                  leftOperand: {
                    name: 'uno',
                    source: 'fooCollection',
                  },
                  rightOperand: null,
                },
                rightOperand: null,
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
    const ifNull: FilterCondition = {
      condition: 'IF_NULL',
      leftOperand: ifNullField,
      rightOperand: null,
    };
    const query: FilterCondition = {
      condition: 'EQUALS',
      leftOperand: ifNull,
      rightOperand: null,
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
      fields: [{ name: 'four' }, { name: 'five' }],
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
});
