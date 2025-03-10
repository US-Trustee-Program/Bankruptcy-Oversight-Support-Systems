import QueryBuilder, { Sort } from '../../../../query/query-builder';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

describe('Mongo Query Renderer', () => {
  const { and, or, not, orderBy, paginate, using } = QueryBuilder;
  const q = using<Foo>();

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
        q('uno').equals('theValue'),
        and(
          q('two').equals(45),
          q('three').equals(true),
          or(q('uno').equals('hello'), q('uno').equals('something')),
        ),
      ),
    );

    expect(actual).toEqual(expected);
  });

  const queries = [
    {
      caseName: 'EXISTS',
      func: () => q('two').exists(),
      expected: { two: { $exists: true } },
    },
    {
      caseName: 'EQUALS',
      func: () => q('two').equals(45),
      expected: { two: { $eq: 45 } },
    },
    {
      caseName: 'GREATER_THAN',
      func: () => q('two').greaterThan(45),
      expected: { two: { $gt: 45 } },
    },
    {
      caseName: 'GREATER_THAN_OR_EQUAL',
      func: () => q('two').greaterThanOrEqual(45),
      expected: { two: { $gte: 45 } },
    },
    {
      caseName: 'CONTAINS',
      func: () => q('two').contains([45]),
      expected: { two: { $in: [45] } },
    },
    {
      caseName: 'LESS_THAN',
      func: () => q('two').lessThan(45),
      expected: { two: { $lt: 45 } },
    },
    {
      caseName: 'LESS_THAN_OR_EQUAL',
      func: () => q('two').lessThanOrEqual(45),
      expected: { two: { $lte: 45 } },
    },
    {
      caseName: 'NOT_EQUAL',
      func: () => q('two').notEqual(45),
      expected: { two: { $ne: 45 } },
    },
    {
      caseName: 'NOT_CONTAINS',
      func: () => q('two').notContains([45]),
      expected: { two: { $nin: [45] } },
    },
    {
      caseName: 'REGEX w/ regex',
      func: () => q('two').regex(/45/),
      expected: { two: { $regex: /45/ } },
    },
    {
      caseName: 'REGEX w/ string',
      func: () => q('two').regex('45'),
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
      func: () => and(q('two').equals(45)),
      expected: { $and: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'OR',
      func: () => or(q('two').equals(45)),
      expected: { $or: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'NOT',
      func: () => not(q('two').equals(45)),
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
          uno: -1,
          two: -1,
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
        },
      },
    ];

    const baseQuery = or(
      q('uno').equals('theValue'),
      and(
        q('two').equals(45),
        q('three').equals(true),
        or(q('uno').equals('hello'), q('uno').equals('something')),
      ),
    );

    const sort: Sort<Foo> = {
      attributes: [
        ['uno', 'DESCENDING'],
        ['two', 'DESCENDING'],
      ],
    };

    const actual = toMongoQuery(paginate(0, 25, [baseQuery], sort));

    expect(actual).toEqual(expected);
  });
});
