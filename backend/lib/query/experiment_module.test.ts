import { aggMongoRender } from './experiment';
import { using } from './experiment_module';
import { CaseDetail } from '../../../common/src/cams/cases';

describe('experiment module.test', () => {
  const { equals2 } = using<CaseDetail>();

  test('should do the thing', () => {
    const expected = { $expr: { $eq: ['$reopenedDate', '$closedDate'] } };
    const query = equals2({ field: 'reopenedDate' }, { field: 'closedDate' });
    expect(aggMongoRender(query)).toEqual(expected);

    // const query2 = equals2()
  });
});
