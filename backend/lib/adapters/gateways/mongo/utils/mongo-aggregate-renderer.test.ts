import QueryPipeline, { Stage } from '../../../../query/query-pipeline';
import MongoAggregateRenderer from './mongo-aggregate-renderer';
import { Condition, Field } from '../../../../query/query-builder';
import { CaseAssignment } from '../../../../../../common/src/cams/assignments';

const { pipeline } = QueryPipeline;

describe('aggregation query renderer tests', () => {
  test('should return paginated aggregation query', () => {
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
        $lookup: {
          from: 'bar',
          localField: 'uno',
          foreignField: 'uno',
          as: 'barDocs',
        },
      },
      {
        $addFields: {
          matchingBars: {
            $filter: {
              input: { $ifNull: ['$barDocs', []] },
              cond: { $eq: ['$$this.name', 'Bob Newhart'] },
            },
          },
        },
      },
      {
        $project: {
          four: 0,
          five: 0,
        },
      },
      {
        $sort: {
          uno: -1,
          two: 1,
        },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: 0,
            },
            {
              $limit: 5,
            },
          ],
        },
      },
    ];

    const query = pipeline(
      queryMatch,
      queryJoin,
      queryAddFields,
      queryProject,
      querySort,
      queryPaginate,
    );

    const actual = MongoAggregateRenderer.toMongoAggregate(query);
    expect(actual).toEqual(expected);
  });

  test('should render simple filter condition', () => {
    const expected = { $eq: ['$$this.name', 'Bob Newhart'] };

    const leftOperand: Field<CaseAssignment> = {
      name: 'name',
    };

    const query: Condition<CaseAssignment> = {
      condition: 'EQUALS',
      leftOperand,
      rightOperand: 'Bob Newhart',
    };
    const actual = MongoAggregateRenderer.toMongoFilterCondition<CaseAssignment>(query);
    expect(actual).toEqual(expected);
  });

  const ifNullCases = [
    ['exists', '$ne', true],
    ['not exists', '$eq', false],
  ];
  test.each(ifNullCases)(
    'should render an $ifNull for the %s case',
    (_caseName: string, condition: string, right: boolean) => {
      const expected = {
        [condition]: [{ $ifNull: ['$$this.unassignedOn', null] }, null],
      };

      const leftOperand: Field<CaseAssignment> = {
        name: 'unassignedOn',
      };

      const query: Condition<CaseAssignment> = {
        condition: 'EXISTS',
        leftOperand,
        rightOperand: right,
      };

      const actual = MongoAggregateRenderer.toMongoFilterCondition<CaseAssignment>(query);
      expect(actual).toEqual(expected);
    },
  );

  test('should render a grouped query', () => {
    const expected = [
      {
        $match: {
          two: {
            $eq: 'hello',
          },
        },
      },
      { $group: { _id: '$userId', name: { $first: '$name' }, total: { $count: {} } } },
    ];

    const simpleMatch: Stage = {
      stage: 'MATCH',
      condition: 'EQUALS',
      leftOperand: { name: 'two' },
      rightOperand: 'hello',
    };

    const group: Stage = {
      stage: 'GROUP',
      groupBy: [{ name: 'userId' }],
      accumulators: [
        { accumulator: 'FIRST', as: { name: 'name' }, field: { name: 'name' } },
        { accumulator: 'COUNT', as: { name: 'total' } },
      ],
    };

    const query = pipeline(simpleMatch, group);

    const actual = MongoAggregateRenderer.toMongoAggregate(query);

    expect(actual).toEqual(expected);
  });
});

const queryMatch: Stage = {
  conjunction: 'OR',
  values: [
    {
      condition: 'EQUALS',
      leftOperand: {
        name: 'uno',
      },
      rightOperand: 'theValue',
    },
    {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'two',
          },
          rightOperand: 45,
        },
        {
          condition: 'EQUALS',
          leftOperand: {
            name: 'three',
          },
          rightOperand: true,
        },
        {
          conjunction: 'OR',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: {
                name: 'uno',
              },
              rightOperand: 'hello',
            },
            {
              condition: 'EQUALS',
              leftOperand: {
                name: 'uno',
              },
              rightOperand: 'something',
            },
          ],
        },
      ],
    },
  ],
  stage: 'MATCH',
};

const queryJoin: Stage = {
  stage: 'JOIN',
  local: {
    name: 'uno',
    source: null,
  },
  foreign: {
    name: 'uno',
    source: 'bar',
  },
  alias: { name: 'barDocs' },
};

const filterCondition: Condition<CaseAssignment> = {
  condition: 'EQUALS',
  leftOperand: {
    name: 'name',
  },
  rightOperand: 'Bob Newhart',
};

const queryAddFields: Stage = {
  stage: 'ADD_FIELDS',
  fields: [
    {
      fieldToAdd: { name: 'matchingBars' },
      querySource: { name: 'barDocs' },
      query: filterCondition,
    },
  ],
};

const queryProject: Stage = {
  stage: 'EXCLUDE',
  fields: [{ name: 'four' }, { name: 'five' }],
};

const querySort: Stage = {
  stage: 'SORT',
  fields: [
    {
      field: { name: 'uno' },
      direction: 'DESCENDING',
    },
    {
      field: { name: 'two' },
      direction: 'ASCENDING',
    },
  ],
};

const queryPaginate: Stage = {
  stage: 'PAGINATE',
  skip: 0,
  limit: 5,
};
