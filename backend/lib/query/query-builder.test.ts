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
  using,
} from './query-builder';

describe('Query Builder', () => {
  type Foo = {
    uno: string;
    two: number;
    three: boolean;
  };

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
    const expected: Conjunction<Foo> = {
      conjunction: 'OR',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { field: 'uno' },
          rightOperand: 'theValue',
          compareFields: false,
        },
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { field: 'two' },
              rightOperand: 45,
              compareFields: false,
            },
            {
              condition: 'EQUALS',
              leftOperand: { field: 'three' },
              rightOperand: true,
              compareFields: false,
            },
            {
              conjunction: 'OR',
              values: [
                {
                  condition: 'EQUALS',
                  leftOperand: { field: 'uno' },
                  rightOperand: 'hello',
                  compareFields: false,
                },
                {
                  condition: 'EQUALS',
                  leftOperand: { field: 'uno' },
                  rightOperand: 'something',
                  compareFields: false,
                },
              ],
            },
          ],
        },
      ],
    };

    const actual = or<Foo>(
      equals<Foo, 'uno'>('uno', 'theValue'),
      and(
        equals<Foo, 'two'>('two', 45),
        equals('three', true),
        or(equals('uno', 'hello'), equals('uno', 'something')),
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
      query: () => equals<Foo, 'two'>('two', 45),
      result: {
        condition: 'EQUALS',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'GREATER_THAN',
      query: () => greaterThan<Foo, 'two'>('two', 45),
      result: {
        condition: 'GREATER_THAN',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      query: () => greaterThanOrEqual<Foo, 'two'>('two', 45),
      result: {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'CONTAINS',
      query: () => contains<Foo, 'two'>('two', [45]),
      result: { condition: 'CONTAINS', leftOperand: { field: 'two' }, rightOperand: [45] },
    },
    {
      condition: 'LESS_THAN',
      query: () => lessThan<Foo, 'two'>('two', 45),
      result: {
        condition: 'LESS_THAN',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      query: () => lessThanOrEqual<Foo, 'two'>('two', 45),
      result: {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'NOT_EQUAL',
      query: () => notEqual<Foo, 'two'>('two', 45),
      result: {
        condition: 'NOT_EQUAL',
        leftOperand: { field: 'two' },
        rightOperand: 45,
        compareFields: false,
      },
    },
    {
      condition: 'NOT_CONTAINS',
      query: () => notContains<Foo, 'two'>('two', [45]),
      result: { condition: 'NOT_CONTAINS', leftOperand: { field: 'two' }, rightOperand: [45] },
    },
    {
      condition: 'REGEX',
      query: () => regex('two', '45'),
      result: { condition: 'REGEX', leftOperand: { field: 'two' }, rightOperand: '45' },
    },
    {
      condition: 'EXISTS',
      query: () => exists<Foo, 'two'>('two'),
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

describe('Query Builder using function', () => {
  type TestPrimitives = {
    someText: string;
    howMany: number;
    howManyMore: number;
    yesNo: boolean;
  };
  const q = using<TestPrimitives>();

  test('should infer the right hand operator type or field from the generic parameter', () => {
    const expectedNumber: Condition<TestPrimitives> = {
      condition: 'EQUALS',
      leftOperand: { field: 'howMany' },
      rightOperand: 1,
    };

    expect(q('howMany').equals(1)).toEqual(expectedNumber);

    const expectedString: Condition<TestPrimitives> = {
      condition: 'EQUALS',
      leftOperand: { field: 'someText' },
      rightOperand: 'foo',
    };

    expect(q('someText').equals('foo')).toEqual(expectedString);

    const expectedBoolean: Condition<TestPrimitives> = {
      condition: 'EQUALS',
      leftOperand: { field: 'yesNo' },
      rightOperand: true,
    };

    expect(q('yesNo').equals(true)).toEqual(expectedBoolean);

    const expectedField: Condition<TestPrimitives> = {
      condition: 'EQUALS',
      leftOperand: { field: 'howMany' },
      rightOperand: { field: 'howManyMore' },
    };

    expect(q('howMany').equals({ field: 'howManyMore' })).toEqual(expectedField);
  });

  const conditionFunctions = [
    {
      name: 'EQUALS',
      fn: q('someText').equals,
      param: 'foo',
      expected: {
        condition: 'EQUALS',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
    {
      name: 'GREATER_THAN',
      fn: q('someText').greaterThan,
      param: 'foo',
      expected: {
        condition: 'GREATER_THAN',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
    {
      name: 'GREATER_THAN_OR_EQUAL',
      fn: q('someText').greaterThanOrEqual,
      param: 'foo',
      expected: {
        condition: 'GREATER_THAN_OR_EQUAL',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
    {
      name: 'LESS_THAN',
      fn: q('someText').lessThan,
      param: 'foo',
      expected: {
        condition: 'LESS_THAN',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
    {
      name: 'LESS_THAN_OR_EQUAL',
      fn: q('someText').lessThanOrEqual,
      param: 'foo',
      expected: {
        condition: 'LESS_THAN_OR_EQUAL',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
    {
      name: 'NOT_EQUAL',
      fn: q('someText').notEqual,
      param: 'foo',
      expected: {
        condition: 'NOT_EQUAL',
        leftOperand: { field: 'someText' },
        rightOperand: 'foo',
      },
    },
  ];

  test.each(conditionFunctions)('should return an $name', (params) => {
    const { fn, param, expected } = params;
    expect(fn(param)).toEqual(expected);
  });
});
