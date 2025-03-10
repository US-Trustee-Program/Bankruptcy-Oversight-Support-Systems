import { toMongoQuery } from './mongo-query-renderer';
import QueryBuilder from '../../../../query/query-builder';
import { SyncedCase } from '../../../../../../common/src/cams/cases';

describe.skip('foo', () => {
  const { and, equals, exists, greaterThan } = QueryBuilder;
  test('should do the thing', () => {
    const expected = {
      $expr: {
        $gt: ['$closedDate', '$reopenedDate'],
      },
    };

    expect(
      toMongoQuery(
        QueryBuilder.build(
          greaterThan<SyncedCase['closedDate']>('closedDate', 'reopenedDate', true),
        ),
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

    const expected3 = {
      $and: [
        { closedDate: { $exists: true } },
        { reopenedDate: { $exists: true } },
        { $expr: { $gt: ['$closedDate', '$reopenedDate'] } },
        { chapter: { $eq: '7' } },
        { $expr: { $eq: ['$closedDate', '$reopenedDate'] } },
      ],
    };

    type Foo = {
      bar: number;
      bar2: number;
      baz: string;
    };

    expect(
      toMongoQuery(
        QueryBuilder.build(
          and(
            exists<SyncedCase>('closedDate', true),
            exists<SyncedCase>('reopenedDate', true),
            greaterThan<SyncedCase['closedDate']>('closedDate', 'reopenedDate', true),
            equals<SyncedCase['chapter']>('chapter', '7'),
            equals<SyncedCase['closedDate']>('closedDate', 'reopenedDate', true),
            greaterThan<Foo['bar']>('bar', 7, true),
            greaterThan<Foo['bar']>('bar', 45, true),
          ),
        ),
      ),
    ).toEqual(expected3);
  });
});
