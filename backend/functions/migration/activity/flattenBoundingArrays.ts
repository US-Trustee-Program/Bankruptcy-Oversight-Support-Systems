import { InvocationContext } from '@azure/functions';
import { Bounds, Predicate } from '../../lib/use-cases/acms-orders/acms-orders';

async function flattenBoundingArrays(
  bounds: Bounds,
  _context: InvocationContext,
): Promise<Predicate[]> {
  const predicates: Predicate[] = [];
  for (const chapter of bounds.chapters) {
    for (const divisionCode of bounds.divisionCodes) {
      predicates.push({
        divisionCode,
        chapter,
      });
    }
  }
  return predicates;
}

export default {
  handler: flattenBoundingArrays,
};
