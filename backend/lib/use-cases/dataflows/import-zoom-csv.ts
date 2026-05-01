import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ZoomInfo, Trustee } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import ModuleNames from '../../../function-apps/dataflows/module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;
const ZOOM_MATCHED_TSV_BLOB_NAME = 'zoom-import.tsv';
const ZOOM_REPORT_BLOB_NAME = 'zoom-import-report.tsv';
const ZOOM_REPORT_HEADERS =
  'zoomName\tzoomEmail\tatsTruIds\tmatchedNames\tmatchCount\tsimilarity\tactiveStatus\tstatusCodes\tmatchStrategy\tcamsTrusteeId\tcamsTrusteeName\toutcome\terror';

const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'Zoom Info Import',
};

type ZoomMatchedRow = {
  zoomName: string;
  zoomEmail: string;
  meetingId: string;
  passcode: string;
  phone: string;
  link: string;
  outcome: string;
  strategy: string;
  atsTruIds: string; // Comma-delimited
  matchedNames: string;
  matchCount: string;
  similarity: string;
  activeStatus: string;
  statusCodes: string;
  ambiguousCandidates: string;
};

type ZoomImportResult = {
  total: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  errors: number;
};

type ProcessResult = {
  outcome: 'matched' | 'unmatched' | 'ambiguous' | 'error';
  matchStrategy?: string;
  matchedTrusteeId?: string;
  matchedTrusteeName?: string;
};

/**
 * Normalizes email for comparison - converts to lowercase and trims whitespace.
 */
function normalizeEmail(email: string | undefined): string {
  return (email || '').toLowerCase().trim();
}

type ZoomHeaderIndices = {
  zoomName: number;
  zoomEmail: number;
  meetingId: number;
  passcode: number;
  phone: number;
  link: number;
  outcome: number;
  strategy: number;
  atsTruIds: number;
  matchedNames: number;
  matchCount: number;
  similarity: number;
  activeStatus: number;
  statusCodes: number;
  ambiguousCandidates: number;
};

/**
 * Builds a header map from the TSV header line, validating required columns.
 */
function buildZoomMatchedHeaderMap(headerLine: string): ZoomHeaderIndices {
  const headers = headerLine.split('\t').map((h) => h.trim());
  const getColumnIndex = (name: string) =>
    headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const indices: ZoomHeaderIndices = {
    zoomName: getColumnIndex('Zoom Name'),
    zoomEmail: getColumnIndex('Zoom Email'),
    meetingId: getColumnIndex('Meeting ID'),
    passcode: getColumnIndex('Passcode'),
    phone: getColumnIndex('Phone'),
    link: getColumnIndex('Link'),
    outcome: getColumnIndex('Outcome'),
    strategy: getColumnIndex('Strategy'),
    atsTruIds: getColumnIndex('ATS TRU_IDs'),
    matchedNames: getColumnIndex('Matched Names'),
    matchCount: getColumnIndex('Match Count'),
    similarity: getColumnIndex('Similarity %'),
    activeStatus: getColumnIndex('Active Status'),
    statusCodes: getColumnIndex('Status Codes'),
    ambiguousCandidates: getColumnIndex('Ambiguous Candidates'),
  };

  // Validate required columns exist
  if (
    indices.zoomName === -1 ||
    indices.atsTruIds === -1 ||
    indices.meetingId === -1 ||
    indices.link === -1
  ) {
    throw new Error(
      'Required columns missing from zoom matching report: Zoom Name, ATS TRU_IDs, Meeting ID, Link',
    );
  }

  return indices;
}

/**
 * Parses a single TSV row into a ZoomMatchedRow object.
 */
function parseZoomMatchedRow(line: string, indices: ZoomHeaderIndices): ZoomMatchedRow {
  const parts = line.split('\t').map((p) => p.trim());

  return {
    zoomName: parts[indices.zoomName] || '',
    zoomEmail: parts[indices.zoomEmail] || '',
    meetingId: parts[indices.meetingId] || '',
    passcode: parts[indices.passcode] || '',
    phone: parts[indices.phone] || '',
    link: parts[indices.link] || '',
    outcome: parts[indices.outcome] || '',
    strategy: parts[indices.strategy] || '',
    atsTruIds: parts[indices.atsTruIds] || '',
    matchedNames: parts[indices.matchedNames] || '',
    matchCount: parts[indices.matchCount] || '',
    similarity: parts[indices.similarity] || '',
    activeStatus: parts[indices.activeStatus] || '',
    statusCodes: parts[indices.statusCodes] || '',
    ambiguousCandidates: parts[indices.ambiguousCandidates] || '',
  };
}

export function parseZoomMatchedTsvFile(content: string): ZoomMatchedRow[] {
  const lines = content.split('\n');
  if (!lines[0]) return [];

  const indices = buildZoomMatchedHeaderMap(lines[0]);
  const rows: ZoomMatchedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    rows.push(parseZoomMatchedRow(line, indices));
  }

  return rows;
}

/**
 * Disambiguate multiple trustee candidates by email match.
 * Returns the single matching trustee, or null if not exactly one match.
 */
function disambiguateByEmail(candidates: Trustee[], zoomEmail?: string): Trustee | null {
  if (!zoomEmail) return null;
  const normalizedZoomEmail = normalizeEmail(zoomEmail);
  const emailFiltered = candidates.filter(
    (t) => normalizeEmail(t.public.email) === normalizedZoomEmail,
  );
  return emailFiltered.length === 1 ? emailFiltered[0] : null;
}

/**
 * Searches for trustees by exact name match.
 */
async function findByExactName(
  context: ApplicationContext,
  normalizedName: string,
): Promise<Trustee[]> {
  const repo = factory.getTrusteesRepository(context);
  return repo.findTrusteesByName(normalizedName);
}

/**
 * Searches for trustees by partial name match (substring).
 */
async function findByPartialName(
  context: ApplicationContext,
  normalizedName: string,
): Promise<Trustee[]> {
  const repo = factory.getTrusteesRepository(context);
  return repo.searchTrusteesByName(normalizedName);
}

/**
 * Searches for trustees by phonetic token matching.
 */
async function findByPhoneticTokens(
  context: ApplicationContext,
  normalizedName: string,
): Promise<Trustee[]> {
  const tokens = generateSearchTokens(normalizedName);
  if (tokens.length === 0) return [];
  const repo = factory.getTrusteesRepository(context);
  return repo.searchTrusteesByPhoneticTokens(tokens);
}

/**
 * Fallback matching logic - tries to find trustee by name when TRU_ID lookup fails.
 * Uses multiple strategies:
 * 1. Exact name match (case-insensitive)
 * 2. Partial name search (substring matching)
 * 3. Phonetic token matching (fuzzy matching using phonetic algorithms)
 * Optional email confirmation for disambiguation.
 */
async function findTrusteeByNameFallback(
  context: ApplicationContext,
  zoomName: string,
  zoomEmail?: string,
): Promise<Trustee | null> {
  const normalizedName = normalizeName(zoomName);

  const strategies: Array<{
    name: string;
    search: () => Promise<Trustee[]>;
  }> = [
    { name: 'exact name', search: () => findByExactName(context, normalizedName) },
    { name: 'partial name', search: () => findByPartialName(context, normalizedName) },
    { name: 'phonetic tokens', search: () => findByPhoneticTokens(context, normalizedName) },
  ];

  for (const strategy of strategies) {
    const candidates = await strategy.search();
    if (candidates.length === 0) continue;

    if (candidates.length === 1) {
      context.logger.info(
        MODULE_NAME,
        `FALLBACK: Found trustee by ${strategy.name}: "${normalizedName}" -> ${candidates[0].trusteeId}`,
      );
      return candidates[0];
    }

    const byEmail = disambiguateByEmail(candidates, zoomEmail);
    if (byEmail) {
      context.logger.info(
        MODULE_NAME,
        `FALLBACK: Found trustee by ${strategy.name} + email: "${normalizedName}" -> ${byEmail.trusteeId}`,
      );
      return byEmail;
    }

    context.logger.warn(
      MODULE_NAME,
      `FALLBACK: Multiple trustees found by ${strategy.name} for "${normalizedName}", cannot disambiguate`,
    );
  }

  context.logger.info(
    MODULE_NAME,
    `FALLBACK: No trustee found for name "${normalizedName}" after trying all strategies`,
  );
  return null;
}

/**
 * Builds a TSV row for the main import report.
 */
function buildMatchedReportRow(row: ZoomMatchedRow, processResult: ProcessResult): string {
  return [
    row.zoomName,
    row.zoomEmail,
    row.atsTruIds,
    row.matchedNames,
    row.matchCount,
    row.similarity,
    row.activeStatus,
    row.statusCodes,
    row.strategy,
    processResult.matchedTrusteeId ?? '',
    processResult.matchedTrusteeName ?? '',
    processResult.outcome,
    '', // error column (empty for now)
  ].join('\t');
}

/**
 * Builds a TSV row for the unmatched report.
 */
function buildUnmatchedReportRow(row: ZoomMatchedRow, outcome: ProcessResult['outcome']): string {
  return [
    row.zoomName,
    row.zoomEmail,
    row.meetingId,
    row.passcode,
    row.phone,
    row.link,
    outcome, // Use computed outcome, not original TSV outcome
    row.strategy,
    row.atsTruIds,
    row.matchedNames,
    row.matchCount,
    row.similarity,
    row.activeStatus,
    row.statusCodes,
    row.ambiguousCandidates,
  ].join('\t');
}

/**
 * Counts outcomes from report lines to ensure metrics match the actual written report.
 * The outcome column is at index 11 in the main report format.
 * Format: zoomName | zoomEmail | atsTruIds | matchedNames | matchCount | similarity |
 *         activeStatus | statusCodes | strategy | matchedTrusteeId | matchedTrusteeName | outcome | error
 */
function countOutcomesFromReportLines(reportLines: string[]): ZoomImportResult {
  const result: ZoomImportResult = { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 };

  // Skip header line (index 0)
  for (let i = 1; i < reportLines.length; i++) {
    const line = reportLines[i].trim();
    if (!line) continue; // Skip empty lines

    const columns = line.split('\t');
    if (columns.length < 12) {
      // Malformed line (need at least 12 columns to get outcome at index 11), skip but continue
      continue;
    }

    const outcome = columns[11]; // outcome is at index 11
    result.total++;

    switch (outcome) {
      case 'matched':
        result.matched++;
        break;
      case 'unmatched':
        result.unmatched++;
        break;
      case 'ambiguous':
        result.ambiguous++;
        break;
      case 'error':
        result.errors++;
        break;
    }
  }

  return result;
}

export async function processZoomMatchedRow(
  context: ApplicationContext,
  row: ZoomMatchedRow,
): Promise<ProcessResult> {
  try {
    const repo = factory.getTrusteesRepository(context);

    // Parse the comma-delimited ATS TRU_IDs
    const atsTruIds = row.atsTruIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    if (atsTruIds.length === 0) {
      context.logger.warn(MODULE_NAME, `No ATS TRU_IDs found for zoom row: ${row.zoomName}`);
      return { outcome: 'error' };
    }

    // Zoom meeting details are now included in the row
    if (!row.meetingId || !row.link) {
      context.logger.error(MODULE_NAME, `Missing zoom meeting details for: ${row.zoomName}`);
      return { outcome: 'error' };
    }

    // For each ATS TRU_ID, find the corresponding CAMS trustee
    // Use a Map to track by CAMS trusteeId to handle deduplicated ATS records
    const camsTrusteesMap = new Map<string, Trustee>(); // Key: CAMS trusteeId
    const notFoundIds: string[] = [];
    const deduplicatedTruIds: string[] = []; // Track which TRU_IDs mapped to existing trustee

    for (const atsTruId of atsTruIds) {
      const trustee = await repo.findTrusteeByLegacyTruId(atsTruId);
      if (trustee) {
        if (camsTrusteesMap.has(trustee.trusteeId)) {
          // This TRU_ID maps to a trustee we've already found - expected for deduplicated records
          deduplicatedTruIds.push(atsTruId);
          context.logger.info(
            MODULE_NAME,
            `Zoom "${row.zoomName}": TRU_ID ${atsTruId} mapped to already-found CAMS trustee ${trustee.trusteeId} - deduplicated ATS record`,
          );
        } else {
          camsTrusteesMap.set(trustee.trusteeId, trustee);
        }
      } else {
        notFoundIds.push(atsTruId);
      }
    }

    const camsTrustees = Array.from(camsTrusteesMap.values());

    // If no trustees found by TRU_ID, fall back to name-based matching
    if (camsTrustees.length === 0) {
      context.logger.warn(
        MODULE_NAME,
        `No CAMS trustees found for ATS TRU_IDs: ${atsTruIds.join(', ')} (zoom: ${row.zoomName}). Attempting fallback name matching.`,
      );

      const fallbackTrustee = await findTrusteeByNameFallback(context, row.zoomName, row.zoomEmail);

      if (!fallbackTrustee) {
        context.logger.error(
          MODULE_NAME,
          `FALLBACK FAILED: No trustee found for "${row.zoomName}" using name matching`,
        );
        return {
          outcome: 'unmatched',
          matchedTrusteeId: undefined,
          matchedTrusteeName: undefined,
        };
      }

      // Use the fallback trustee
      camsTrustees.push(fallbackTrustee);
      context.logger.info(
        MODULE_NAME,
        `FALLBACK SUCCESS: Using trustee ${fallbackTrustee.trusteeId} for zoom "${row.zoomName}"`,
      );
    }

    // If multiple ATS trustees mapped to the same zoom, mark as ambiguous for manual review
    if (camsTrustees.length > 1) {
      context.logger.warn(
        MODULE_NAME,
        `Multiple CAMS trustees found for zoom "${row.zoomName}": ${camsTrustees.map((t) => t.trusteeId).join(', ')}. Marking as ambiguous for manual resolution.`,
      );
      return {
        outcome: 'ambiguous',
        matchStrategy: row.strategy,
        matchedTrusteeId: undefined,
        matchedTrusteeName: undefined,
      };
    }

    const targetTrustee = camsTrustees[0];

    if (notFoundIds.length > 0) {
      context.logger.info(
        MODULE_NAME,
        `Some ATS TRU_IDs not found in CAMS for zoom "${row.zoomName}": ${notFoundIds.join(', ')}`,
      );
    }

    // Create zoom info object from row data
    const zoomInfo: ZoomInfo = {
      link: row.link,
      phone: row.phone,
      meetingId: row.meetingId,
      passcode: row.passcode,
      accountEmail: row.zoomEmail || undefined,
    };

    // Update the trustee with zoom info
    await repo.updateTrustee(targetTrustee.trusteeId, { ...targetTrustee, zoomInfo }, SYSTEM_USER);

    context.logger.info(
      MODULE_NAME,
      `Updated trustee ${targetTrustee.trusteeId} (${targetTrustee.name}) with zoom info from match strategy: ${row.strategy}`,
    );

    return {
      outcome: 'matched',
      matchStrategy: row.strategy,
      matchedTrusteeId: targetTrustee.trusteeId,
      matchedTrusteeName: targetTrustee.name,
    };
  } catch (originalError) {
    const camsError = getCamsError(
      originalError as Error,
      MODULE_NAME,
      `Failed to process zoom matched row for "${row.zoomName}"`,
    );
    context.logger.error(MODULE_NAME, camsError.message, camsError);
    return { outcome: 'error' };
  }
}

export async function importZoomCsv(context: ApplicationContext): Promise<ZoomImportResult> {
  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, ZOOM_MATCHED_TSV_BLOB_NAME);

  if (!content) {
    context.logger.info(
      MODULE_NAME,
      'No zoom matching report found in object storage — skipping import',
    );
    return { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 };
  }

  const rows = parseZoomMatchedTsvFile(content);

  const reportLines: string[] = [ZOOM_REPORT_HEADERS];
  const unmatchedRows: Array<{ row: ZoomMatchedRow; outcome: ProcessResult['outcome'] }> = [];

  for (const row of rows) {
    const processResult = await processZoomMatchedRow(context, row);

    // Collect unmatched, ambiguous, and error rows for remediation report
    if (
      processResult.outcome === 'unmatched' ||
      processResult.outcome === 'ambiguous' ||
      processResult.outcome === 'error'
    ) {
      unmatchedRows.push({ row, outcome: processResult.outcome });
    }

    reportLines.push(buildMatchedReportRow(row, processResult));
  }

  // Count outcomes from the actual report lines to ensure accuracy
  const result = countOutcomesFromReportLines(reportLines);

  context.logger.info(MODULE_NAME, `Import complete: ${JSON.stringify(result)}`);

  await objectStorage.writeObject(containerName, ZOOM_REPORT_BLOB_NAME, reportLines.join('\n'));
  context.logger.info(MODULE_NAME, `Report saved to ${containerName}/${ZOOM_REPORT_BLOB_NAME}`);

  // Write unmatched report
  if (unmatchedRows.length > 0) {
    const unmatchedReportLines: string[] = [
      'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
    ];

    for (const { row, outcome } of unmatchedRows) {
      unmatchedReportLines.push(buildUnmatchedReportRow(row, outcome));
    }

    const UNMATCHED_REPORT_BLOB_NAME = 'zoom-import-unmatched-report.tsv';
    await objectStorage.writeObject(
      containerName,
      UNMATCHED_REPORT_BLOB_NAME,
      unmatchedReportLines.join('\n'),
    );
    context.logger.info(
      MODULE_NAME,
      `Unmatched report saved to ${containerName}/${UNMATCHED_REPORT_BLOB_NAME} (${unmatchedRows.length} records)`,
    );
  } else {
    context.logger.info(MODULE_NAME, 'No unmatched records to report');
  }

  return result;
}
