import QueryBuilder, {
  Condition,
  Conjunction,
  isCondition,
  isConjunction,
  isPagination,
  isSort,
  Pagination,
  Sort,
  SortedAttribute,
} from './query-builder';

describe('Query Builder', () => {
  type Foo = {
    uno: string;
    two: number;
    three: boolean;
  };

  const { not, and, or, orderBy, using } = QueryBuilder;
  const q = using<Foo>();

  test('should build correct query tree', () => {
    const expected: Conjunction<Foo> = {
      conjunction: 'OR',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { field: 'uno' },
          rightOperand: 'theValue',
        },
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { field: 'two' },
              rightOperand: 45,
            },
            {
              condition: 'EQUALS',
              leftOperand: { field: 'three' },
              rightOperand: true,
            },
            {
              conjunction: 'OR',
              values: [
                {
                  condition: 'EQUALS',
                  leftOperand: { field: 'uno' },
                  rightOperand: 'hello',
                },
                {
                  condition: 'EQUALS',
                  leftOperand: { field: 'uno' },
                  rightOperand: 'something',
                },
              ],
            },
          ],
        },
      ],
    };

    const actual = or(
      q('uno').equals('theValue'),
      and(
        q('two').equals(45),
        q('three').equals(true),
        or(q('uno').equals('hello'), q('uno').equals('something')),
      ),
    );

    expect(actual).toEqual(expected);
  });

  const staticEqualCondition: Condition<Foo> = {
    condition: 'EQUALS',
    leftOperand: { field: 'two' },
    rightOperand: 45,
  };

  const simpleQueryCases = [
    {
      condition: 'EQUALS',
      query: () => q('two').equals(45),
      result: {
        condition: 'EQUALS',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'GREATER_THAN',
      query: () => q('two').greaterThan(45),
      result: {
        condition: 'GREATER_THAN',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      query: () => q('two').greaterThanOrEqual(45),
      result: {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'CONTAINS',
      query: () => q('two').contains([45]),
      result: { condition: 'CONTAINS', leftOperand: { field: 'two' }, rightOperand: [45] },
    },
    {
      condition: 'LESS_THAN',
      query: () => q('two').lessThan(45),
      result: {
        condition: 'LESS_THAN',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      query: () => q('two').lessThanOrEqual(45),
      result: {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'NOT_EQUAL',
      query: () => q('two').notEqual(45),
      result: {
        condition: 'NOT_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
      },
    },
    {
      condition: 'NOT_CONTAINS',
      query: () => q('two').notContains([45, 55]),
      result: { condition: 'NOT_CONTAINS', leftOperand: { field: 'two' }, rightOperand: [45, 55] },
    },
    {
      condition: 'REGEX',
      query: () => q('two').regex('45'),
      result: { condition: 'REGEX', leftOperand: { field: 'two' }, rightOperand: '45' },
    },
    {
      condition: 'EXISTS',
      query: () => q('two').exists(),
      result: { condition: 'EXISTS', leftOperand: { field: 'two' }, rightOperand: true },
    },
  ];

  test.each(simpleQueryCases)('should handle $condition condition', (testQuery) => {
    const query = testQuery.query();
    expect(query).toEqual(testQuery.result);
  });

  const conjunctionCases = [
    {
      conjunction: 'AND',
      query: () => and(staticEqualCondition),
      result: { conjunction: 'AND', values: [staticEqualCondition] },
    },
    {
      conjunction: 'OR',
      query: () => or(staticEqualCondition),
      result: { conjunction: 'OR', values: [staticEqualCondition] },
    },
    {
      conjunction: 'NOT',
      query: () => not(staticEqualCondition),
      result: { conjunction: 'NOT', values: [staticEqualCondition] },
    },
  ];

  test.each(conjunctionCases)('should handle $conjunction conjunction', (conjunctionQuery) => {
    const query = conjunctionQuery.query();
    expect(query).toEqual(conjunctionQuery.result);
  });

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const attributeFoo: SortedAttribute<Foo> = ['uno', 'ASCENDING'];
    const attributeBar: SortedAttribute<Foo> = ['uno', 'DESCENDING'];
    expect(orderBy<Foo>(attributeFoo)).toEqual({ attributes: [attributeFoo] });
    expect(orderBy<Foo>(attributeFoo, attributeBar)).toEqual({
      attributes: [attributeFoo, attributeBar],
    });
  });

  test('isCondition', () => {
    const condition: Condition<Foo> = {
      condition: 'REGEX',
      leftOperand: { field: 'uno' },
      rightOperand: '',
    };
    expect(isCondition(condition)).toBeTruthy();
    expect(isCondition({})).toBeFalsy();
  });

  test('isConjunction', () => {
    const conjunction: Conjunction = {
      conjunction: 'AND',
      values: [],
    };
    expect(isConjunction(conjunction)).toBeTruthy();
    expect(isConjunction({})).toBeFalsy();
  });

  test('isSort', () => {
    const sort: Sort<Foo> = {
      attributes: [['uno', 'ASCENDING']],
    };
    expect(isSort(sort)).toBeTruthy();
    expect(isSort({})).toBeFalsy();
  });

  test('isPagination', () => {
    const pagination: Pagination = {
      limit: 100,
      skip: 0,
      values: [],
    };
    expect(isPagination(pagination)).toBeTruthy();
    const notPagination = {
      foo: 'bar',
    };
    expect(isPagination(notPagination)).toBeFalsy();
  });
});
