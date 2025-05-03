import QueryBuilder, { Field, Query } from '../../../../query/query-builder';
import { toMongoQuery, toMongoSort } from './mongo-query-renderer';

type Foo = {
  three: boolean;
  two: number;
  uno: string;
};

describe('Mongo Query Renderer', () => {
  const { and, not, or, using } = QueryBuilder;
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
      expected: { two: { $exists: true } },
      func: () => doc('two').exists(),
    },
    {
      caseName: 'EQUALS',
      expected: { two: { $eq: 45 } },
      func: () => doc('two').equals(45),
    },
    {
      caseName: 'GREATER_THAN',
      expected: { two: { $gt: 45 } },
      func: () => doc('two').greaterThan(45),
    },
    {
      caseName: 'GREATER_THAN_OR_EQUAL',
      expected: { two: { $gte: 45 } },
      func: () => doc('two').greaterThanOrEqual(45),
    },
    {
      caseName: 'CONTAINS',
      expected: { two: { $in: [45] } },
      func: () => doc('two').contains([45]),
    },
    {
      caseName: 'LESS_THAN',
      expected: { two: { $lt: 45 } },
      func: () => doc('two').lessThan(45),
    },
    {
      caseName: 'LESS_THAN_OR_EQUAL',
      expected: { two: { $lte: 45 } },
      func: () => doc('two').lessThanOrEqual(45),
    },
    {
      caseName: 'NOT_EQUALS',
      expected: { two: { $ne: 45 } },
      func: () => doc('two').notEqual(45),
    },
    {
      caseName: 'NOT_CONTAINS',
      expected: { two: { $nin: [45] } },
      func: () => doc('two').notContains([45]),
    },
    {
      caseName: 'REGEX w/ regex',
      expected: { two: { $regex: /45/ } },
      func: () => doc('two').regex(/45/),
    },
    {
      caseName: 'REGEX w/ string',
      expected: { two: { $regex: '45' } },
      func: () => doc('two').regex('45'),
    },
  ];

  test.each(queries)('should render a mongo query for $caseName condition', (args) => {
    const actual = toMongoQuery(args.func());
    expect(actual).toEqual(args.expected);
  });

  const conjunctions = [
    {
      caseName: 'AND',
      expected: { $and: [{ two: { $eq: 45 } }] },
      func: () => and(doc('two').equals(45)),
    },
    {
      caseName: 'OR',
      expected: { $or: [{ two: { $eq: 45 } }] },
      func: () => or(doc('two').equals(45)),
    },
    {
      caseName: 'NOT',
      expected: { $not: [{ two: { $eq: 45 } }] },
      func: () => not(doc('two').equals(45)),
    },
  ];

  test.each(conjunctions)('should render a mongo query for $caseName aggregation', (args) => {
    const actual = toMongoQuery(args.func());
    expect(actual).toEqual(args.expected);
  });

  type ExprTest = {
    condition: string;
    fn: (rightOperand: Field<Foo> | string) => Query<Foo>;
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

  test('should render a sort expression', () => {
    const expected = {
      bar: -1,
      foo: 1,
    };
    const actual = toMongoSort({
      fields: [
        { direction: 'ASCENDING', field: { name: 'foo' } },
        { direction: 'DESCENDING', field: { name: 'bar' } },
      ],
    });
    expect(actual).toEqual(expected);
  });
});
