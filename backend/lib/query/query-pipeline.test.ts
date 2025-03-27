import QueryPipeline, {
  isPaginate,
  isSort,
  Paginate,
  Sort,
  SortedAttribute,
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

  const additionalDocs = 'barDocs';

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const attributeFoo: SortedAttribute<Foo> = ascending<Foo>('uno');
    const attributeBar: SortedAttribute<Bar> = descending<Bar>('four');
    expect(sort(attributeFoo)).toEqual({ stage: 'SORT', attributes: [attributeFoo] });
    expect(sort(attributeFoo, attributeBar)).toEqual({
      stage: 'SORT',
      attributes: [attributeFoo, attributeBar],
    });
  });

  test('should proxy a Join stage', () => {
    const expected = {
      stage: 'JOIN',
      local: {
        field: 'uno',
        source: null,
      },
      foreign: {
        field: 'uno',
        source: 'bar',
      },
      alias: 'barDocs',
    };

    const actual = join<Bar>('bar', 'uno').onto<Foo>('uno').as(additionalDocs);

    expect(actual).toEqual(expected);
  });

  test('should proxy an AddFields stage', () => {
    const expected = {
      stage: 'ADD_FIELDS',
      fields: [
        {
          field: 'matchingBars',
          source: 'barDocs',
          query: {
            conjunction: 'AND',
            values: [],
          },
        },
      ],
    };

    const actual = addFields(
      additionalField('matchingBars', additionalDocs, {
        conjunction: 'AND',
        values: [],
      }),
    );

    expect(actual).toEqual(expected);
  });

  test('should proxy an Exclude stage', () => {
    const expected = {
      stage: 'EXCLUDE',
      fields: ['four', 'five'],
    };

    const actual = exclude<Bar>(['four', 'five']);

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
      fields: ['four', 'five'],
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
      attributes: [{ field: 'uno', direction: 'ASCENDING' }],
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
