import { deepEqual } from './objectEquality';

describe('objectEquality tests', () => {
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
      three: 'three',
      two: 'two',
    };
    const object2 = {
      one: 1,
      three: 3,
      two: 2,
    };

    expect(deepEqual(object1, object2)).toEqual(false);
  });

  test('should return false if comparing 2 complex objects that dont match', () => {
    const object1 = {
      one: 'one',
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
      two: {
        a: 'a',
        b: {
          i: 'one',
          ii: 'two',
        },
      },
    };

    const object2 = {
      one: 'one',
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
      two: {
        a: 'a',
        b: {
          i: 'ai',
          ii: 'ai-ai',
        },
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
      4: 'four',
      one: 'one',
      three: 3,
      two: 'two',
    };

    const object2 = {
      4: 'four',
      one: 'one',
      three: 3,
      two: 'two',
    };

    expect(deepEqual(object1, object2)).toEqual(true);
  });

  test('should return true if complex objects are equal', () => {
    const object1 = {
      one: 'one',
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
      two: {
        a: 'a',
        b: {
          i: 'one',
          ii: 'two',
        },
      },
    };

    const object2 = {
      one: 'one',
      three: {
        a: 'Aee',
        b: 'Bee',
        c: 'See',
      },
      two: {
        a: 'a',
        b: {
          i: 'one',
          ii: 'two',
        },
      },
    };

    expect(deepEqual(object1, object2)).toEqual(true);
  });
});
