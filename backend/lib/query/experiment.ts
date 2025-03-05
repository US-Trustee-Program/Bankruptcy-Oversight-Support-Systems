import { CaseDetail } from '../../../common/src/cams/cases';
import { UpgradedCondition, using } from './experiment_module';

type Condition = UpgradedCondition<CaseDetail>;

const { equals, isField } = using<CaseDetail>();

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

// Adding the second parameter type to the generic argument is OPTIONAL.
const chapterTest1 = equals<CaseDetail['chapter']>({ field: 'chapter' }, '12');
const chapterTest2 = equals({ field: 'chapter' }, '12');
console.log('chapterTest1', JSON.stringify(ogMongoRender(chapterTest1)));
console.log('chapterTest2', JSON.stringify(ogMongoRender(chapterTest2)));

///

const query = equals<CaseDetail['reopenedDate']>(
  { field: 'reopenedDate' },
  { field: 'closedDate' },
);
const query2 = equals({ field: 'reopenedDate' }, '2025-01-01');

console.log('OG', JSON.stringify(ogMongoRender(query)));
console.log('OG 2', JSON.stringify(ogMongoRender(query2)));

console.log('AGGREGATE', JSON.stringify(aggMongoRender(query)));
console.log('AGGREGATE 2', JSON.stringify(aggMongoRender(query2)));
