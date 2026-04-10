import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { MaybeData } from './queue-types';
import { Trustee } from '@common/cams/trustees';

const MODULE_NAME = 'BACKFILL-TRUSTEE-PHONETIC-TOKENS-USE-CASE';

type BackfillTrusteeResult = {
  trusteeId: string;
  success: boolean;
  error?: string;
};

/**
 * Gets all trustees that need phonetic token backfill.
 * A trustee needs backfill if phoneticTokens is missing or empty.
 */
async function getTrusteesNeedingBackfill(
  context: ApplicationContext,
): Promise<MaybeData<Trustee[]>> {
  try {
    const repo = factory.getTrusteesRepository(context);
    const allTrustees = await repo.listTrustees();

    const needsBackfill = allTrustees.filter(
      (t) => !t.phoneticTokens || t.phoneticTokens.length === 0,
    );

    return { data: needsBackfill };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to get trustees needing phonetic token backfill.',
      ),
    };
  }
}

/**
 * Backfills phonetic tokens for a batch of trustees.
 * Uses setPhoneticTokens to add tokens without replacing the entire document.
 */
async function backfillTokensForTrustees(
  context: ApplicationContext,
  trustees: Trustee[],
): Promise<MaybeData<BackfillTrusteeResult[]>> {
  const results: BackfillTrusteeResult[] = [];

  try {
    const repo = factory.getTrusteesRepository(context);

    for (const trustee of trustees) {
      try {
        const tokens = generateSearchTokens(trustee.name);
        await repo.setPhoneticTokens(trustee.trusteeId, tokens);

        results.push({
          trusteeId: trustee.trusteeId,
          success: true,
        });
      } catch (originalError) {
        results.push({
          trusteeId: trustee.trusteeId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
      }
    }

    return { data: results };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to backfill tokens for trustees.'),
    };
  }
}

const BackfillTrusteePhoneticTokens = {
  getTrusteesNeedingBackfill,
  backfillTokensForTrustees,
};

export default BackfillTrusteePhoneticTokens;
