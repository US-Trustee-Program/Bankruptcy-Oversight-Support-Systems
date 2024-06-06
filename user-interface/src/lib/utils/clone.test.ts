import { describe, expect } from 'vitest';
import { deepClone } from './clone';

describe('clone module', () => {
  describe('deepClone', () => {
    test('should deep clone an object', () => {
      type TestType = {
        child: { prop1: string; prop2: number };
        child2: { prop1: string; prop2: number };
      };
      const originalObject: TestType = {
        child: {
          prop1: 'prop1',
          prop2: 0,
        },
        child2: {
          prop1: 'prop1',
          prop2: 0,
        },
      };
      const clonedObject = deepClone(originalObject);
      Object.keys(originalObject).forEach((key) => {
        expect(originalObject[key as keyof TestType] === clonedObject[key]).toBeFalsy();
      });
    });
  });
});
