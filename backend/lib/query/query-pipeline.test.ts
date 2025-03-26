import QueryPipeline, {
  isPaginate,
  isSort,
  Paginate,
  Sort,
  SortedAttribute,
} from './query-pipeline';

const { orderBy } = QueryPipeline;

describe('Query Pipeline', () => {
  type Foo = {
    uno: string;
    two: number;
    three: boolean;
  };

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const attributeFoo: SortedAttribute<Foo> = ['uno', 'ASCENDING'];
    const attributeBar: SortedAttribute<Foo> = ['uno', 'DESCENDING'];
    expect(orderBy(attributeFoo)).toEqual({ stage: 'SORT', attributes: [attributeFoo] });
    expect(orderBy(attributeFoo, attributeBar)).toEqual({
      stage: 'SORT',
      attributes: [attributeFoo, attributeBar],
    });
  });

  test('isSort', () => {
    const sort: Sort = {
      stage: 'SORT',
      attributes: [['uno', 'ASCENDING']],
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
