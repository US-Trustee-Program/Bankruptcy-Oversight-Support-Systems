import { CaseDetail } from '../../../common/src/cams/cases';
import { UpgradedCondition, using } from './experiment_module';

type Condition = UpgradedCondition<CaseDetail>;

const { equals, equals2, isField } = using<CaseDetail>();

equals('caseNumber', '000-11-22222');
equals('reopenedDate', { field: 'closedDate' });

function ogMongoRender(query: Condition) {
  // imagine '$eq" came from query.condition through mapCondition...
  const render = {
    [query.leftOperand.field]: { $eq: query.rightOperand },
  };
  return render;
}

// If this take a Field<T> then we can map f.field to the template
function field(f: string) {
  return `$${f}`;
}

function aggMongoRender(query: Condition) {
  // imagine '$eq" came from query.condition through mapCondition...
  const render = isField(query.rightOperand)
    ? {
        $expr: {
          $eq: [field(query.leftOperand.field), field(query.rightOperand.field)],
        },
      }
    : ogMongoRender(query);
  return render;
}

///

const query = equals2({ field: 'reopenedDate' }, { field: 'closedDate' });
const query2 = equals2({ field: 'reopenedDate' }, '2025-01-01');

console.log('OG', JSON.stringify(ogMongoRender(query)));
console.log('OG 2', JSON.stringify(ogMongoRender(query2)));

console.log('AGGREGATE', JSON.stringify(aggMongoRender(query)));
console.log('AGGREGATE 2', JSON.stringify(aggMongoRender(query2)));
