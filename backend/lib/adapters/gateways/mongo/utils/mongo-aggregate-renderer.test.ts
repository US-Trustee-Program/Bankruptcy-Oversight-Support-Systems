import QueryBuilder from '../../../../query/query-builder';
import QueryPipeline from '../../../../query/query-pipeline';

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

const { and, or, using } = QueryBuilder;
const doc = using<Foo>();
const { pipeline, orderBy, paginate, match } = QueryPipeline;

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
        $lookup: {},
      },
      {
        $addFields: {},
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
    );
  });
});
