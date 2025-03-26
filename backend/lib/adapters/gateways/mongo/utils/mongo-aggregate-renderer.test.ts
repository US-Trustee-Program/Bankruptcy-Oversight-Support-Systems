import QueryBuilder from '../../../../query/query-builder';
import QueryPipeline from '../../../../query/query-pipeline';
import { toMongoAggregate } from './mongo-aggregate-renderer';

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

type Bar = {
  uno: string;
};

const { pipeline, paginate, match, sort, ascending, descending, join, addFields, additionalField } =
  QueryPipeline;
const { and, or, using } = QueryBuilder;
const doc = using<Foo>();

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
      // {
      //   $project: {},
      // },
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

    const sortUno = descending<Foo>('uno');
    const sortTwo = ascending<Foo>('two');

    const additionalDocs = 'barDocs';
    const query = pipeline(
      match(
        or(
          doc('uno').equals('theValue'),
          and(
            doc('two').equals(45),
            doc('three').equals(true),
            or(doc('uno').equals('hello'), doc('uno').equals('something')),
          ),
        ),
      ),
      join<Bar>('bar', 'uno').onto<Foo>('uno').as(additionalDocs),
      addFields(additionalField('matchingBars', additionalDocs, and())),
      sort(sortUno, sortTwo),
      paginate(0, 5),
    );

    const actual = toMongoAggregate(query);
    expect(actual).toEqual(expected);

    console.log(JSON.stringify(actual, null, 2));
  });
});
