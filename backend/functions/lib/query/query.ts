export const QueryDialect = {
  MONGO: 'MONGO',
  TSQL: 'TSQL',
  COSMOS: 'COSMOS',
} as const;

class QueryBuilder {
  log(...params) {
    console.log(params);
  }
}

interface Conjunction<_T> {}

interface Next<T> {
  and: Conjunction<T>;
  or: Conjunction<T>;
}

interface Comparison<T, V> {
  (value: V): Next<T>;
}

function _next<T>(_builder: QueryBuilder): Next<T> {
  return {
    and: () => {},
    or: () => {},
  };
}

function _equals<T, K, V>(builder: QueryBuilder, key: K): Comparison<T, V> {
  return function (value: V) {
    builder.log('==', key, value);
    return _next<T>(builder);
  };
}

interface Comparisons<T, V> {
  equals: Comparison<T, V>;
  // greaterThan(): Conjunction;
  // greaterThanOrEqual(): Conjunction;
  // lessThan(): Conjunction;
  // lessThanOrEqual(): Conjunction;
  // notEqual(): Conjunction;
  // notContains(): Conjunction;
  // not(): Conjunction;
}

function _comparisons<T, K, V>(builder: QueryBuilder, key: K): Comparisons<T, V> {
  return {
    equals: _equals<T, K, V>(builder, key),
    // greaterThan: _greaterThan<T, V>(builder),
    // greaterThanOrEqual: _greaterThanOrEqual<T, V>(builder),
    // lessThan: _lessThan<T, V>(builder),
    // lessThanOrEqual: _lessThanOrEqual<T, V>(builder),
    // notEqual: _notEqual<T, V>(builder),
    // notContains: _notContains<T, V>(builder),
    // not: _not<T, V>(builder),
  };
}

function _where<T, K = keyof T>(builder: QueryBuilder) {
  return <V>(key: K) => {
    return _comparisons<T, K, V>(builder, key);
  };
}

function find<T>() {
  const builder = new QueryBuilder();
  return {
    where: _where<T>(builder),
    with: () => {}, // give ourselves the ability to reach a nested property. "with" provides another T sub of original T.
  };
}

export const Q = {
  find,
};

export default Q;

type Foo = {
  uno: string;
  two: number;
  three: boolean;
};

// Test chaining
Q.find<Foo>().where<Foo['uno']>('two').equals('');

// type _works = Foo['uno'];

// const theKey = 'one';
// type _noWork = Foo[theKey];
