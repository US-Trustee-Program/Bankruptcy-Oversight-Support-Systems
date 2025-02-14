import { InvocationContext } from '@azure/functions';
import {
  AcmsBounds,
  AcmsPredicate,
} from '../../../../lib/use-cases/dataflows/migrate-consolidations';

async function flattenBoundingArrays(
  bounds: AcmsBounds,
  _context: InvocationContext,
): Promise<AcmsPredicate[]> {
  const predicates: AcmsPredicate[] = [];
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
