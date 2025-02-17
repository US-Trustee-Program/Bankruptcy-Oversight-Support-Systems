import QueryBuilder, { Sort } from '../../../../query/query-builder';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

describe('Mongo Query Renderer', () => {
  const {
    equals,
    greaterThan,
    greaterThanOrEqual,
    contains,
    lessThan,
    lessThanOrEqual,
    notEqual,
    notContains,
    exists,
    and,
    or,
    not,
    regex,
    orderBy,
    paginate,
  } = QueryBuilder;

  test('should render a mongo query JSON', () => {
    const expected = {
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
    };

    const actual = toMongoQuery(
      or(
        equals<string>('uno', 'theValue'),
        and(
          equals<Foo['two']>('two', 45),
          equals('three', true),
          or(equals('uno', 'hello'), equals('uno', 'something')),
        ),
      ),
    );

    expect(actual).toEqual(expected);
  });

  const queries = [
    {
      caseName: 'EXISTS',
      func: () => exists('two', true),
      expected: { two: { $exists: true } },
    },
    {
      caseName: 'EQUALS',
      func: () => equals('two', 45),
      expected: { two: { $eq: 45 } },
    },
    {
      caseName: 'GREATER_THAN',
      func: () => greaterThan('two', 45),
      expected: { two: { $gt: 45 } },
    },
    {
      caseName: 'GREATER_THAN_OR_EQUAL',
      func: () => greaterThanOrEqual('two', 45),
      expected: { two: { $gte: 45 } },
    },
    {
      caseName: 'CONTAINS',
      func: () => contains<number>('two', [45]),
      expected: { two: { $in: [45] } },
    },
    {
      caseName: 'LESS_THAN',
      func: () => lessThan('two', 45),
      expected: { two: { $lt: 45 } },
    },
    {
      caseName: 'LESS_THAN_OR_EQUAL',
      func: () => lessThanOrEqual('two', 45),
      expected: { two: { $lte: 45 } },
    },
    {
      caseName: 'NOT_EQUAL',
      func: () => notEqual('two', 45),
      expected: { two: { $ne: 45 } },
    },
    {
      caseName: 'NOT_CONTAINS',
      func: () => notContains<number>('two', [45]),
      expected: { two: { $nin: [45] } },
    },
    {
      caseName: 'REGEX w/ regex',
      func: () => regex('two', '45'),
      expected: { two: { $regex: '45' } },
    },
    {
      caseName: 'REGEX w/ string',
      func: () => regex('two', '45'),
      expected: { two: { $regex: '45' } },
    },
  ];

  test.each(queries)('should render a mongo query for $caseName condition', (args) => {
    const actual = toMongoQuery(args.func());
    expect(actual).toEqual(args.expected);
  });

  const conjunctions = [
    {
      caseName: 'AND',
      func: () => and(equals('two', 45)),
      expected: { $and: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'OR',
      func: () => or(equals('two', 45)),
      expected: { $or: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'NOT',
      func: () => not(equals('two', 45)),
      expected: { $not: [{ two: { $eq: 45 } }] },
    },
  ];

  test.each(conjunctions)('should render a mongo query for $caseName aggregation', (args) => {
    const actual = toMongoQuery(args.func());
    expect(actual).toEqual(args.expected);
  });

  test('sort renders ascending and descending', () => {
    expect(toMongoSort(orderBy(['foo', 'ASCENDING']))).toEqual({ foo: 1 });
    expect(toMongoSort(orderBy(['foo', 'DESCENDING']))).toEqual({ foo: -1 });
  });

  test('sort renders multiple sort expressions', () => {
    expect(toMongoSort(orderBy(['foo', 'ASCENDING'], ['bar', 'DESCENDING']))).toEqual({
      foo: 1,
      bar: -1,
    });
  });

  test('should render a paginated aggregate mongo query JSON', () => {
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
        $sort: {
          dateFiled: -1,
          caseId: -1,
        },
      },
      {
        $facet: {
          data: [
            {
              $skip: 0,
            },
            {
              $limit: 25,
            },
          ],
          metadata: [{ $count: 'total' }],
        },
      },
    ];

    const baseQuery = or(
      equals<string>('uno', 'theValue'),
      and(
        equals<Foo['two']>('two', 45),
        equals('three', true),
        or(equals('uno', 'hello'), equals('uno', 'something')),
      ),
    );

    const sort: Sort = {
      attributes: [
        ['dateFiled', 'DESCENDING'],
        ['caseId', 'DESCENDING'],
      ],
    };

    const actual = toMongoQuery(paginate(0, 25, [baseQuery], sort));

    expect(actual).toEqual(expected);
  });
});
