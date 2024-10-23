import { toMongoQuery } from './mongo-query-renderer';
import QueryBuilder from './query-builder';

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

    const actual = QueryBuilder.build(
      toMongoQuery,
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
      func: () => contains('two', 45),
      expected: { two: { $in: 45 } },
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
      func: () => notContains('two', 45),
      expected: { two: { $nin: 45 } },
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
    const actual = QueryBuilder.build(toMongoQuery, args.func());
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
    const actual = QueryBuilder.build(toMongoQuery, args.func());
    expect(actual).toEqual(args.expected);
  });
});
