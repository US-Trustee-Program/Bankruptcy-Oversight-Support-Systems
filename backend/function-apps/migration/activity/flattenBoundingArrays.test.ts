import { InvocationContext } from '@azure/functions';
import { AcmsBounds, AcmsPredicate } from '../../../lib/use-cases/acms-orders/acms-orders';
import module from './flattenBoundingArrays';

describe('Flatten bounding arrays activity', () => {
  test('should transform bounding arrays into predicates', async () => {
    const context = {} as InvocationContext;
    const bounds: AcmsBounds = {
      chapters: ['11', '15'],
      divisionCodes: ['000', '111'],
    };
    const expectedOuput: AcmsPredicate[] = [
      { chapter: '11', divisionCode: '000' },
      { chapter: '11', divisionCode: '111' },
      { chapter: '15', divisionCode: '000' },
      { chapter: '15', divisionCode: '111' },
    ];
    const output = await module.handler(bounds, context);
    expect(output).toEqual(expectedOuput);
  });
});
