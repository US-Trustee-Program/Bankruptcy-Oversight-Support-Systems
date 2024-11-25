import { InvocationContext } from '@azure/functions';
import { Bounds, Predicate } from '../../lib/use-cases/acms-orders/acms-orders';
import module from './flattenBoundingArrays';

describe('Flatten bounding arrays activity', () => {
  test('should transform bounding arrays into predicates', async () => {
    const context = {} as InvocationContext;
    const bounds: Bounds = {
      chapters: ['11', '15'],
      divisionCodes: ['000', '111'],
    };
    const expectedOuput: Predicate[] = [
      { chapter: '11', divisionCode: '000' },
      { chapter: '11', divisionCode: '111' },
      { chapter: '15', divisionCode: '000' },
      { chapter: '15', divisionCode: '111' },
    ];
    const output = await module.handler(bounds, context);
    expect(output).toEqual(expectedOuput);
  });
});
