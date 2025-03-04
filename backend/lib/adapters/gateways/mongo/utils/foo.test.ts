import { toMongoQuery } from './mongo-query-renderer';
import QueryBuilder from '../../../../query/query-builder';
import { SyncedCase } from '../../../../../../common/src/cams/cases';

describe('foo', () => {
  const { greaterThan } = QueryBuilder;
  test('should do the thing', () => {
    const expected = {
      $expr: {
        $gt: ['$closedDate', '$reopenedDate'],
      },
    };

    expect(
      toMongoQuery(
        QueryBuilder.build(greaterThan<SyncedCase['closedDate']>('closedDate', 'reopenedDate')),
        true,
      ),
    ).toEqual(expected);

    const expected2 = {
      closedDate: {
        $gt: '2025-01-01',
      },
    };
    expect(
      toMongoQuery(
        QueryBuilder.build(greaterThan<SyncedCase['closedDate']>('closedDate', '2025-01-01')),
      ),
    ).toEqual(expected2);
  });
});
