import { deepEqual } from './object-equality';

describe('objectEquality tests', () => {
  test('should return true when objects are the same reference', () => {
    const object = { a: 1, b: 2 };

    expect(deepEqual(object, object)).toEqual(true);
  });

  test('should return false when parameters are not objects', () => {
    const object = { a: 1, b: 2 };
    const nullObject = null as unknown as object;
    const undefinedObject = undefined as unknown as object;

    expect(deepEqual(nullObject, object)).toEqual(false);
    expect(deepEqual(object, nullObject)).toEqual(false);
    expect(deepEqual(undefinedObject, object)).toEqual(false);
    expect(deepEqual(object, undefinedObject)).toEqual(false);
    // @ts-expect-error: Testing with non-object parameters
    expect(deepEqual('string', 123)).toEqual(false);
  });
  test('should return false when objects have different number of keys', () => {
    const object1 = {
      one: 'one',
      two: 'two',
      three: 'three',
    };
    const object2 = {
      one: 'one',
      two: 'two',
    };

    expect(deepEqual(object1, object2)).toEqual(false);
  });
  test('should return false if comparing simple arrays that are not equal', () => {
    const array1 = ['one', 'two', 'three'];
    const array2 = ['three', 'two', 'one'];
    const array3 = [1, 2, 'three'];

    expect(deepEqual(array1, array2)).toEqual(false);
    expect(deepEqual(array1, array3)).toEqual(false);
  });

  test('should return false if comparing 2 simple objects that dont match', () => {
    const object1 = {
      one: 'one',
      two: 'two',
      three: 'three',
    };
    const object2 = {
      one: 1,
      two: 2,
      three: 3,
    };

    expect(deepEqual(object1, object2)).toEqual(false);
  });

  test('should return false if comparing 2 complex objects that dont match', () => {
    const object1 = {
      one: 'one',
      two: {
        a: 'a',
        b: {
          i: 'one',
          ii: 'two',
        },
      },
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
    };

    const object2 = {
      one: 'one',
      two: {
        a: 'a',
        b: {
          i: 'ai',
          ii: 'ai-ai',
        },
      },
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
    };

    expect(deepEqual(object1, object2)).toEqual(false);
  });

  test('should return true if comparing simple arrays that are equal', () => {
    const array1 = ['one', 'two', 3];
    const array2 = ['one', 'two', 3];

    expect(deepEqual(array1, array2)).toEqual(true);
  });

  test('should return true if simple objects are equal', () => {
    const object1 = {
      one: 'one',
      two: 'two',
      three: 3,
      4: 'four',
    };

    const object2 = {
      two: 'two',
      4: 'four',
      three: 3,
      one: 'one',
    };

    expect(deepEqual(object1, object2)).toEqual(true);
  });

  test('should return true if complex objects are equal', () => {
    const object1 = {
      one: 'one',
      two: {
        a: 'a',
        b: {
          i: 'one',
          ii: 'two',
        },
      },
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
    };

    const object2 = {
      one: 'one',
      three: {
        a: 'Aee',
        c: 'See',
        b: 'Bee',
      },
      two: {
        b: {
          ii: 'two',
          i: 'one',
        },
        a: 'a',
      },
    };

    expect(deepEqual(object1, object2)).toEqual(true);
  });
});
