import QueryPipeline, { Stage } from '../../../../query/query-pipeline';
import { toMongoAggregate } from './mongo-aggregate-renderer';

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
              input: 'barDocs',
              cond: {
                $and: [],
              },
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

    const actual = toMongoAggregate(query);
    expect(actual).toEqual(expected);
  });
});

const queryMatch: Stage = {
  conjunction: 'OR',
  values: [
    {
      condition: 'EQUALS',
      leftOperand: {
        field: 'uno',
      },
      rightOperand: 'theValue',
    },
    {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: {
            field: 'two',
          },
          rightOperand: 45,
        },
        {
          condition: 'EQUALS',
          leftOperand: {
            field: 'three',
          },
          rightOperand: true,
        },
        {
          conjunction: 'OR',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: {
                field: 'uno',
              },
              rightOperand: 'hello',
            },
            {
              condition: 'EQUALS',
              leftOperand: {
                field: 'uno',
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
    field: 'uno',
    source: null,
  },
  foreign: {
    field: 'uno',
    source: 'bar',
  },
  alias: 'barDocs',
};

const queryAddFields: Stage = {
  stage: 'ADD_FIELDS',
  fields: [
    {
      field: 'matchingBars',
      source: 'barDocs',
      query: {
        conjunction: 'AND',
        values: [],
      },
    },
  ],
};

const queryProject: Stage = {
  stage: 'EXCLUDE',
  fields: ['four', 'five'],
};

const querySort: Stage = {
  stage: 'SORT',
  attributes: [
    {
      field: 'uno',
      direction: 'DESCENDING',
    },
    {
      field: 'two',
      direction: 'ASCENDING',
    },
  ],
};

const queryPaginate: Stage = {
  stage: 'PAGINATE',
  skip: 0,
  limit: 5,
};
