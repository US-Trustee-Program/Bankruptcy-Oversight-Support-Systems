import { CaseDetail } from '../../../common/src/cams/cases';
import { mod, UpgradedCondition, using } from './experiment_module';

type Condition = UpgradedCondition<CaseDetail>;

const { equals2: myEqual } = mod;

type Foo = {
  bar: boolean;
  bar2: number;
  baz: string;
  baz2: string[];
};

// This does seem to get the benefit of TypeScript in that the field names are suggested.
myEqual<CaseDetail>({ field: 'closedDate' }, { field: 'reopenedDate' });
myEqual<Foo>({ field: 'bar' }, { field: 'baz2' });

// This is not working as we would hope. Note that the type for `bar` is boolean.
myEqual<Foo>({ field: 'bar' }, false);
myEqual<Foo>({ field: 'bar' }, 'hello world');

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

export function aggMongoRender(query: Condition) {
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
