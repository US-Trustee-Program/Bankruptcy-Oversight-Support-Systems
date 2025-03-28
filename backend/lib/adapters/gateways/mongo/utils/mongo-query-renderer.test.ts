import QueryBuilder, { Field, Query, Sort } from '../../../../query/query-builder';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

describe('Mongo Query Renderer', () => {
  const { and, or, not, orderBy, paginate, using } = QueryBuilder;
  const doc = using<Foo>();

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
        doc('uno').equals('theValue'),
        and(
          doc('two').equals(45),
          doc('three').equals(true),
          or(doc('uno').equals('hello'), doc('uno').equals('something')),
        ),
      ),
    );

    expect(actual).toEqual(expected);
  });

  const queries = [
    {
      caseName: 'EXISTS',
      func: () => doc('two').exists(),
      expected: { two: { $exists: true } },
    },
    {
      caseName: 'EQUALS',
      func: () => doc('two').equals(45),
      expected: { two: { $eq: 45 } },
    },
    {
      caseName: 'GREATER_THAN',
      func: () => doc('two').greaterThan(45),
      expected: { two: { $gt: 45 } },
    },
    {
      caseName: 'GREATER_THAN_OR_EQUAL',
      func: () => doc('two').greaterThanOrEqual(45),
      expected: { two: { $gte: 45 } },
    },
    {
      caseName: 'CONTAINS',
      func: () => doc('two').contains([45]),
      expected: { two: { $in: [45] } },
    },
    {
      caseName: 'LESS_THAN',
      func: () => doc('two').lessThan(45),
      expected: { two: { $lt: 45 } },
    },
    {
      caseName: 'LESS_THAN_OR_EQUAL',
      func: () => doc('two').lessThanOrEqual(45),
      expected: { two: { $lte: 45 } },
    },
    {
      caseName: 'NOT_EQUAL',
      func: () => doc('two').notEqual(45),
      expected: { two: { $ne: 45 } },
    },
    {
      caseName: 'NOT_CONTAINS',
      func: () => doc('two').notContains([45]),
      expected: { two: { $nin: [45] } },
    },
    {
      caseName: 'REGEX w/ regex',
      func: () => doc('two').regex(/45/),
      expected: { two: { $regex: /45/ } },
    },
    {
      caseName: 'REGEX w/ string',
      func: () => doc('two').regex('45'),
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
      func: () => and(doc('two').equals(45)),
      expected: { $and: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'OR',
      func: () => or(doc('two').equals(45)),
      expected: { $or: [{ two: { $eq: 45 } }] },
    },
    {
      caseName: 'NOT',
      func: () => not(doc('two').equals(45)),
      expected: { $not: [{ two: { $eq: 45 } }] },
    },
  ];

  test.each(conjunctions)('should render a mongo query for $caseName aggregation', (args) => {
    const actual = toMongoQuery(args.func());
    expect(actual).toEqual(args.expected);
  });

  type ExprTest = {
    condition: string;
    fn: (rightOperand: string | Field<Foo>) => Query<Foo>;
    mongoOperation: string;
  };
  const exprTests: ExprTest[] = [
    {
      condition: 'EQUALS',
      fn: doc('uno').equals,
      mongoOperation: '$eq',
    },
    {
      condition: 'GREATER_THAN',
      fn: doc('uno').greaterThan,
      mongoOperation: '$gt',
    },
    {
      condition: 'GREATER_THAN_OR_EQUAL',
      fn: doc('uno').greaterThanOrEqual,
      mongoOperation: '$gte',
    },
    {
      condition: 'LESS_THAN',
      fn: doc('uno').lessThan,
      mongoOperation: '$lt',
    },
    {
      condition: 'LESS_THAN_OR_EQUAL',
      fn: doc('uno').lessThanOrEqual,
      mongoOperation: '$lte',
    },
    {
      condition: 'EQUALS',
      fn: doc('uno').equals,
      mongoOperation: '$eq',
    },
    {
      condition: 'EQUALS',
      fn: doc('uno').notEqual,
      mongoOperation: '$ne',
    },
  ];
  test.each(exprTests)('should render $EXPR queries for $condition', (params) => {
    const expected = {
      $expr: {
        [params.mongoOperation]: ['$uno', '$two'],
      },
    };

    const actual = toMongoQuery(params.fn({ name: 'two' }));
    expect(actual).toEqual(expected);
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
      doc('uno').equals('theValue'),
      and(
        doc('two').equals(45),
        doc('three').equals(true),
        or(doc('uno').equals('hello'), doc('uno').equals('something')),
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
