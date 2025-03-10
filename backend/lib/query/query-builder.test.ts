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
  const {
    equals,
    greaterThan,
    greaterThanOrEqual,
    contains,
    lessThan,
    lessThanOrEqual,
    notEqual,
    notContains,
    not,
    exists,
    and,
    or,
    regex,
    orderBy,
  } = QueryBuilder;

  test('should build correct query tree', () => {
    const { and, or, equals } = QueryBuilder;

    type Foo = {
      uno: string;
      two: number;
      three: boolean;
    };

    const expected: Conjunction = {
      conjunction: 'OR',
      values: [
        { condition: 'EQUALS', leftOperand: 'uno', rightOperand: 'theValue', compareFields: false },
        {
          conjunction: 'AND',
          values: [
            { condition: 'EQUALS', leftOperand: 'two', rightOperand: 45, compareFields: false },
            { condition: 'EQUALS', leftOperand: 'three', rightOperand: true, compareFields: false },
            {
              conjunction: 'OR',
              values: [
                {
                  condition: 'EQUALS',
                  leftOperand: 'uno',
                  rightOperand: 'hello',
                  compareFields: false,
                },
                {
                  condition: 'EQUALS',
                  leftOperand: 'uno',
                  rightOperand: 'something',
                  compareFields: false,
                },
              ],
            },
          ],
        },
      ],
    };

    const actual = or(
      equals<string>('uno', 'theValue'),
      and(
        equals<Foo['two']>('two', 45),
        equals('three', true),
        or(equals('uno', 'hello'), equals('uno', 'something')),
      ),
    );

    expect(actual).toEqual(expected);
  });
  const staticEqualCondition: Condition = {
    condition: 'EQUALS',
    leftOperand: 'two',
    rightOperand: 45,
  };

  const simpleQueryCases = [
    {
      condition: 'EQUALS',
      query: () => equals('two', 45),
      result: { condition: 'EQUALS', leftOperand: 'two', rightOperand: 45, compareFields: false },
    },
    {
      condition: 'GREATER_THAN',
      query: () => greaterThan('two', 45),
      result: {
        condition: 'GREATER_THAN',
        leftOperand: 'two',
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      query: () => greaterThanOrEqual('two', 45),
      result: {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand: 'two',
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'CONTAINS',
      query: () => contains<number>('two', [45]),
      result: { condition: 'CONTAINS', leftOperand: 'two', rightOperand: [45] },
    },
    {
      condition: 'LESS_THAN',
      query: () => lessThan('two', 45),
      result: {
        condition: 'LESS_THAN',
        leftOperand: 'two',
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      query: () => lessThanOrEqual('two', 45),
      result: {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand: 'two',
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'NOT_EQUAL',
      query: () => notEqual('two', 45),
      result: {
        condition: 'NOT_EQUAL',
        leftOperand: 'two',
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'NOT_CONTAINS',
      query: () => notContains<number>('two', [45]),
      result: { condition: 'NOT_CONTAINS', leftOperand: 'two', rightOperand: [45] },
    },
    {
      condition: 'REGEX',
      query: () => regex('two', '45'),
      result: { condition: 'REGEX', leftOperand: 'two', rightOperand: '45' },
    },
    {
      condition: 'EXISTS',
      query: () => exists('two', true),
      result: { condition: 'EXISTS', leftOperand: 'two', rightOperand: true },
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
      condition: 'NOT',
      query: () => not(staticEqualCondition),
      result: { conjunction: 'NOT', values: [staticEqualCondition] },
    },
  ];

  test.each(conjunctionCases)('should handle $conjunction conjunction', (conjunctionQuery) => {
    const query = conjunctionQuery.query();
    expect(query).toEqual(conjunctionQuery.result);
  });

  test('should proxy a query passed to the build function', () => {
    const query = or();
    const actual = QueryBuilder.build(query);
    expect(actual).toEqual(query);
  });

  test('should proxy a list of SortDirection when orderBy is called', () => {
    const attributeFoo: SortedAttribute = ['foo', 'ASCENDING'];
    const attributeBar: SortedAttribute = ['bar', 'DESCENDING'];
    expect(orderBy(attributeFoo)).toEqual({ attributes: [attributeFoo] });
    expect(orderBy(attributeFoo, attributeBar)).toEqual({
      attributes: [attributeFoo, attributeBar],
    });
  });

  test('isCondition', () => {
    const condition: Condition = {
      condition: 'REGEX',
      leftOperand: '',
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
    const sort: Sort = {
      attributes: [['foo', 'ASCENDING']],
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
