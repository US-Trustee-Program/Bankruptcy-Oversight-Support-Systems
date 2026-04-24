import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ZoomInfo, Trustee } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import { calculateStringSimilarity } from '@common/cams/utilities';
import ModuleNames from '../../../function-apps/dataflows/module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;
const ZOOM_TSV_BLOB_NAME = 'zoom-info.tsv';
const ZOOM_REPORT_BLOB_NAME = 'zoom-import-report.tsv';
const ZOOM_REPORT_HEADERS =
  'fullName\taccountEmail\tmeetingId\tpasscode\tphone\tlink\toutcome\tmatchStrategy\tmatchedTrusteeId\tmatchedTrusteeName';

const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

type ZoomTsvRow = {
  fullName: string;
  accountEmail: string | undefined;
  meetingId: string;
  passcode: string;
  phone: string;
  link: string;
};

type ZoomImportResult = {
  total: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  errors: number;
};

type MatchStrategy = 'exact-name' | 'email' | 'fuzzy-name';

type MatchResult = {
  trustee: Trustee;
  strategy: MatchStrategy;
} | null;

type ProcessResult = {
  outcome: 'matched' | 'unmatched' | 'ambiguous' | 'error';
  matchStrategy?: MatchStrategy;
  matchedTrusteeId?: string;
  matchedTrusteeName?: string;
};

/**
 * Normalizes email for comparison - converts to lowercase and trims whitespace.
 */
function normalizeEmail(email: string | undefined): string {
  return (email || '').toLowerCase().trim();
}

export function parseZoomTsvFile(content: string): ZoomTsvRow[] {
  const lines = content.split('\n');
  const rows: ZoomTsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = line.split('\t').map((p) => p.trim());
    if (parts.length < 8) {
      continue;
    }

    rows.push({
      fullName: parts[2],
      accountEmail: parts[3] || undefined,
      meetingId: parts[4],
      passcode: parts[5],
      phone: parts[6],
      link: parts[7],
    });
  }

  return rows;
}

/**
 * Multi-step trustee matching strategy for zoom CSV import.
 *
 * Matching steps (in order):
 * 1. Email match - if zoom email matches trustee public email (exact, case-insensitive)
 * 2. Exact name match - current behavior using normalized name
 * 3. Fuzzy name match - uses string similarity with 85% threshold
 *
 * Returns matched trustee and the strategy used, or null if no match found.
 * Returns 'ambiguous' string if multiple candidates found with same score.
 */
async function findMatchingTrustee(
  context: ApplicationContext,
  row: ZoomTsvRow,
): Promise<MatchResult | 'ambiguous'> {
  const repo = factory.getTrusteesRepository(context);
  const normalizedName = normalizeName(row.fullName);

  // Step 1: Try email match
  if (row.accountEmail) {
    const allTrustees = await repo.listTrustees();
    const normalizedZoomEmail = normalizeEmail(row.accountEmail);

    const emailMatches = allTrustees.filter((t) => {
      const trusteeEmail = normalizeEmail(t.public.email);
      return trusteeEmail && trusteeEmail === normalizedZoomEmail;
    });

    if (emailMatches.length === 1) {
      context.logger.info(
        MODULE_NAME,
        `MATCHED by email: "${normalizedName}" -> ${emailMatches[0].trusteeId}`,
      );
      return { trustee: emailMatches[0], strategy: 'email' };
    }

    if (emailMatches.length > 1) {
      context.logger.warn(
        MODULE_NAME,
        `AMBIGUOUS by email: "${normalizedName}" (${row.accountEmail}) matched ${emailMatches.length} trustees`,
      );
      return 'ambiguous';
    }
  }

  // Step 2: Try exact name match
  const exactMatches = await repo.findTrusteesByName(normalizedName);

  if (exactMatches.length === 1) {
    context.logger.info(
      MODULE_NAME,
      `MATCHED by exact name: "${normalizedName}" -> ${exactMatches[0].trusteeId}`,
    );
    return { trustee: exactMatches[0], strategy: 'exact-name' };
  }

  if (exactMatches.length > 1) {
    // Try to disambiguate with email if available
    if (row.accountEmail) {
      const normalizedZoomEmail = normalizeEmail(row.accountEmail);
      const emailFiltered = exactMatches.filter((t) => {
        const trusteeEmail = normalizeEmail(t.public.email);
        return trusteeEmail === normalizedZoomEmail;
      });

      if (emailFiltered.length === 1) {
        context.logger.info(
          MODULE_NAME,
          `MATCHED by exact name + email disambiguation: "${normalizedName}" -> ${emailFiltered[0].trusteeId}`,
        );
        return { trustee: emailFiltered[0], strategy: 'exact-name' };
      }
    }

    context.logger.warn(
      MODULE_NAME,
      `AMBIGUOUS by exact name: "${normalizedName}" matched ${exactMatches.length} trustees`,
    );
    return 'ambiguous';
  }

  // Step 3: Try fuzzy name match with 85% similarity threshold
  const FUZZY_THRESHOLD = 85;
  const allTrustees = await repo.listTrustees();

  const fuzzyScores = allTrustees
    .map((trustee) => ({
      trustee,
      similarity: calculateStringSimilarity(normalizedName, normalizeName(trustee.name)),
    }))
    .filter((score) => score.similarity >= FUZZY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);

  if (fuzzyScores.length === 0) {
    context.logger.info(
      MODULE_NAME,
      `UNMATCHED: "${normalizedName}" (no fuzzy matches above ${FUZZY_THRESHOLD}%)`,
    );
    return null;
  }

  // Check if we have a clear winner (top score significantly better than others)
  const topScore = fuzzyScores[0];
  const runnerUp = fuzzyScores[1];

  if (!runnerUp || topScore.similarity - runnerUp.similarity >= 5) {
    // Try to confirm with email if available
    if (row.accountEmail) {
      const normalizedZoomEmail = normalizeEmail(row.accountEmail);
      const trusteeEmail = normalizeEmail(topScore.trustee.public.email);

      if (trusteeEmail && trusteeEmail !== normalizedZoomEmail) {
        context.logger.warn(
          MODULE_NAME,
          `UNMATCHED: "${normalizedName}" fuzzy matched ${topScore.trustee.trusteeId} (${topScore.similarity.toFixed(1)}%) but email mismatch`,
        );
        return null;
      }
    }

    context.logger.info(
      MODULE_NAME,
      `MATCHED by fuzzy name: "${normalizedName}" -> ${topScore.trustee.trusteeId} (${topScore.similarity.toFixed(1)}% similarity)`,
    );
    return { trustee: topScore.trustee, strategy: 'fuzzy-name' };
  }

  context.logger.warn(
    MODULE_NAME,
    `AMBIGUOUS by fuzzy name: "${normalizedName}" has ${fuzzyScores.length} similar matches`,
  );
  return 'ambiguous';
}

export async function processZoomTsvRow(
  context: ApplicationContext,
  row: ZoomTsvRow,
): Promise<ProcessResult> {
  try {
    const matchResult = await findMatchingTrustee(context, row);

    if (matchResult === 'ambiguous') {
      return { outcome: 'ambiguous' };
    }

    if (!matchResult) {
      return { outcome: 'unmatched' };
    }

    const { trustee, strategy } = matchResult;
    const zoomInfo: ZoomInfo = {
      link: row.link,
      phone: row.phone,
      meetingId: row.meetingId,
      passcode: row.passcode,
      accountEmail: row.accountEmail || undefined,
    };

    const repo = factory.getTrusteesRepository(context);
    await repo.updateTrustee(trustee.trusteeId, { ...trustee, zoomInfo }, SYSTEM_USER);

    context.logger.info(
      MODULE_NAME,
      `Updated trustee ${trustee.trusteeId} with zoom info (matched by ${strategy})`,
    );

    return {
      outcome: 'matched',
      matchStrategy: strategy,
      matchedTrusteeId: trustee.trusteeId,
      matchedTrusteeName: trustee.name,
    };
  } catch (originalError) {
    const camsError = getCamsError(
      originalError as Error,
      MODULE_NAME,
      `Failed to process row for "${row.fullName}"`,
    );
    context.logger.error(MODULE_NAME, camsError.message, camsError);
    return { outcome: 'error' };
  }
}

type ZoomTsvRowDiagnosis = {
  fullName: string;
  normalizedName: string;
  matchCount: number;
  outcome: 'matched' | 'unmatched' | 'ambiguous';
  matchedTrusteeIds: string[];
};

/** @public */
export async function diagnoseZoomCsvImport(
  context: ApplicationContext,
): Promise<ZoomTsvRowDiagnosis[]> {
  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, ZOOM_TSV_BLOB_NAME);

  if (!content) {
    return [];
  }

  const rows = parseZoomTsvFile(content);
  const repo = factory.getTrusteesRepository(context);
  const diagnoses: ZoomTsvRowDiagnosis[] = [];

  for (const row of rows) {
    const normalizedName = normalizeName(row.fullName);
    const trustees = await repo.findTrusteesByName(normalizedName);
    const matchCount = trustees.length;
    const outcome = matchCount === 0 ? 'unmatched' : matchCount === 1 ? 'matched' : 'ambiguous';

    diagnoses.push({
      fullName: row.fullName,
      normalizedName,
      matchCount,
      outcome,
      matchedTrusteeIds: trustees.map((t) => t.trusteeId),
    });
  }

  return diagnoses;
}

export async function importZoomCsv(context: ApplicationContext): Promise<ZoomImportResult> {
  const result: ZoomImportResult = { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 };

  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, ZOOM_TSV_BLOB_NAME);

  if (!content) {
    context.logger.info(MODULE_NAME, 'No zoom TSV found in object storage — skipping import');
    return result;
  }

  const rows = parseZoomTsvFile(content);
  result.total = rows.length;

  const reportLines: string[] = [ZOOM_REPORT_HEADERS];

  for (const row of rows) {
    const processResult = await processZoomTsvRow(context, row);
    result[
      processResult.outcome === 'matched'
        ? 'matched'
        : processResult.outcome === 'unmatched'
          ? 'unmatched'
          : processResult.outcome === 'ambiguous'
            ? 'ambiguous'
            : 'errors'
    ]++;
    reportLines.push(
      [
        row.fullName,
        row.accountEmail ?? '',
        row.meetingId,
        row.passcode,
        row.phone,
        row.link,
        processResult.outcome,
        processResult.matchStrategy ?? '',
        processResult.matchedTrusteeId ?? '',
        processResult.matchedTrusteeName ?? '',
      ].join('\t'),
    );
  }

  context.logger.info(MODULE_NAME, `Import complete: ${JSON.stringify(result)}`);

  await objectStorage.writeObject(containerName, ZOOM_REPORT_BLOB_NAME, reportLines.join('\n'));
  context.logger.info(MODULE_NAME, `Report saved to ${containerName}/${ZOOM_REPORT_BLOB_NAME}`);

  return result;
}
