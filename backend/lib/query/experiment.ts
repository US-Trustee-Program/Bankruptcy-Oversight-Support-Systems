import { CaseDetail } from '../../../common/src/cams/cases';
import { isField, UpgradedCondition, using } from './experiment_module';

type Condition = UpgradedCondition<CaseDetail>;

const caseDetail = using<CaseDetail>();

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
const chapterTest1 = caseDetail('chapter').equals({ field: 'caseId' });

caseDetail('caseId').equals({ field: 'caseId' });

const chapterTest2 = caseDetail('chapter').equals('2025-01-01');
console.log('chapterTest1', JSON.stringify(ogMongoRender(chapterTest1)));
console.log('chapterTest2', JSON.stringify(ogMongoRender(chapterTest2)));

///

const query = caseDetail('reopenedDate').equals({ field: 'closedDate' });
const query2 = caseDetail('reopenedDate').equals('2025-01-01');

console.log('OG', JSON.stringify(ogMongoRender(query)));
console.log('OG 2', JSON.stringify(ogMongoRender(query2)));

console.log('AGGREGATE', JSON.stringify(aggMongoRender(query)));
console.log('AGGREGATE 2', JSON.stringify(aggMongoRender(query2)));

///

type Primitives = {
  someText: string;
  howMany: number;
  yesNo: boolean;
};

const testType = using<Primitives>();

testType('howMany').equals(1);
testType('yesNo').equals(false);
// testType('yesNo').equals('');
testType('someText').equals('test');
// testType('someText').equals(1);
// testType('someText').equals(true);
