import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';

const MODULE_NAME = 'TRUSTEE-MATCH';

/**
 * Normalizes a name by trimming whitespace and collapsing multiple spaces.
 * This is the canonical normalization function for trustee name matching.
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Escapes special regex characters in a string for safe use in RegExp.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function matchTrusteeByName(
  context: ApplicationContext,
  trusteeName: string,
): Promise<string> {
  const normalized = normalizeName(trusteeName);
  const trusteesRepo = factory.getTrusteesRepository(context);
  const matches = await trusteesRepo.findTrusteesByName(normalized);

  if (matches.length === 0) {
    throw new CamsError(MODULE_NAME, {
      message: `No CAMS trustee found matching name "${normalized}".`,
    });
  }

  if (matches.length > 1) {
    const candidates = matches.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    throw new CamsError(MODULE_NAME, {
      message: `Multiple CAMS trustees found matching name "${normalized}": ${candidates}.`,
    });
  }

  return matches[0].trusteeId;
}
