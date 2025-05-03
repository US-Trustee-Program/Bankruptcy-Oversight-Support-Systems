import { CaseAssignment } from '../../../../../../common/src/cams/assignments';
import { Condition, Field } from '../../../../query/query-builder';
import QueryPipeline, { Stage } from '../../../../query/query-pipeline';
import { toMongoAggregate, toMongoFilterCondition } from './mongo-aggregate-renderer';

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
          as: 'barDocs',
          foreignField: 'uno',
          from: 'bar',
          localField: 'uno',
        },
      },
      {
        $addFields: {
          matchingBars: {
            $filter: {
              cond: { $eq: ['$$this.name', 'Bob Newhart'] },
              input: { $ifNull: ['$barDocs', []] },
            },
          },
        },
      },
      {
        $project: {
          five: 0,
          four: 0,
        },
      },
      {
        $sort: {
          two: 1,
          uno: -1,
        },
      },
      {
        $facet: {
          data: [
            {
              $skip: 0,
            },
            {
              $limit: 5,
            },
          ],
          metadata: [{ $count: 'total' }],
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

    const actual = toMongoAggregate(query);
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
    const actual = toMongoFilterCondition<CaseAssignment>(query);
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

      const actual = toMongoFilterCondition<CaseAssignment>(query);
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
      condition: 'EQUALS',
      leftOperand: { name: 'two' },
      rightOperand: 'hello',
      stage: 'MATCH',
    };

    const group: Stage = {
      accumulators: [
        { accumulator: 'FIRST', as: { name: 'name' }, field: { name: 'name' } },
        { accumulator: 'COUNT', as: { name: 'total' } },
      ],
      groupBy: [{ name: 'userId' }],
      stage: 'GROUP',
    };

    const query = pipeline(simpleMatch, group);

    const actual = toMongoAggregate(query);

    expect(actual).toEqual(expected);
  });
});

const queryMatch: Stage = {
  conjunction: 'OR',
  stage: 'MATCH',
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
};

const queryJoin: Stage = {
  alias: { name: 'barDocs' },
  foreign: {
    name: 'uno',
    source: 'bar',
  },
  local: {
    name: 'uno',
    source: null,
  },
  stage: 'JOIN',
};

const filterCondition: Condition<CaseAssignment> = {
  condition: 'EQUALS',
  leftOperand: {
    name: 'name',
  },
  rightOperand: 'Bob Newhart',
};

const queryAddFields: Stage = {
  fields: [
    {
      fieldToAdd: { name: 'matchingBars' },
      query: filterCondition,
      querySource: { name: 'barDocs' },
    },
  ],
  stage: 'ADD_FIELDS',
};

const queryProject: Stage = {
  fields: [{ name: 'four' }, { name: 'five' }],
  stage: 'EXCLUDE',
};

const querySort: Stage = {
  fields: [
    {
      direction: 'DESCENDING',
      field: { name: 'uno' },
    },
    {
      direction: 'ASCENDING',
      field: { name: 'two' },
    },
  ],
  stage: 'SORT',
};

const queryPaginate: Stage = {
  limit: 5,
  skip: 0,
  stage: 'PAGINATE',
};
