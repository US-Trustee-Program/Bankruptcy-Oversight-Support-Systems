import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';

const MODULE_NAME = 'TRUSTEE-MATCH';

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
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
