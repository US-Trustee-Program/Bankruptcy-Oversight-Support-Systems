import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ZoomInfo, Trustee } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { normalizeName } from './trustee-match.helpers';
import ModuleNames from '../../../function-apps/dataflows/module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;
const ZOOM_MATCHED_TSV_BLOB_NAME = 'zoom-matching-report-matched.tsv';
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

export function parseZoomMatchedTsvFile(content: string): ZoomMatchedRow[] {
  const lines = content.split('\n');
  const rows: ZoomMatchedRow[] = [];

  // Parse header to get column indices
  const headerLine = lines[0];
  if (!headerLine) {
    return rows;
  }

  const headers = headerLine.split('\t').map((h) => h.trim());
  const getColumnIndex = (name: string) =>
    headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const indices = {
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
  if (indices.zoomName === -1 || indices.atsTruIds === -1 || indices.meetingId === -1) {
    throw new Error(
      'Required columns missing from zoom matching report: Zoom Name, ATS TRU_IDs, Meeting ID',
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = line.split('\t').map((p) => p.trim());

    rows.push({
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
    });
  }

  return rows;
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
  const repo = factory.getTrusteesRepository(context);
  const normalizedName = normalizeName(zoomName);

  // Step 1: Try exact name match
  const exactMatches = await repo.findTrusteesByName(normalizedName);

  if (exactMatches.length === 1) {
    context.logger.info(
      MODULE_NAME,
      `FALLBACK: Found trustee by exact name: "${normalizedName}" -> ${exactMatches[0].trusteeId}`,
    );
    return exactMatches[0];
  }

  if (exactMatches.length > 1) {
    // Try to disambiguate with email if available
    if (zoomEmail) {
      const normalizedZoomEmail = normalizeEmail(zoomEmail);
      const emailFiltered = exactMatches.filter((t) => {
        const trusteeEmail = normalizeEmail(t.public.email);
        return trusteeEmail === normalizedZoomEmail;
      });

      if (emailFiltered.length === 1) {
        context.logger.info(
          MODULE_NAME,
          `FALLBACK: Found trustee by exact name + email: "${normalizedName}" -> ${emailFiltered[0].trusteeId}`,
        );
        return emailFiltered[0];
      }
    }

    context.logger.warn(
      MODULE_NAME,
      `FALLBACK: Multiple trustees found for exact name "${normalizedName}", trying fuzzy search`,
    );
  }

  // Step 2: Try partial name search (substring matching)
  const partialMatches = await repo.searchTrusteesByName(normalizedName);

  if (partialMatches.length === 1) {
    context.logger.info(
      MODULE_NAME,
      `FALLBACK: Found trustee by partial name search: "${normalizedName}" -> ${partialMatches[0].trusteeId}`,
    );
    return partialMatches[0];
  }

  if (partialMatches.length > 1 && zoomEmail) {
    const normalizedZoomEmail = normalizeEmail(zoomEmail);
    const emailFiltered = partialMatches.filter((t) => {
      const trusteeEmail = normalizeEmail(t.public.email);
      return trusteeEmail === normalizedZoomEmail;
    });

    if (emailFiltered.length === 1) {
      context.logger.info(
        MODULE_NAME,
        `FALLBACK: Found trustee by partial name + email: "${normalizedName}" -> ${emailFiltered[0].trusteeId}`,
      );
      return emailFiltered[0];
    }
  }

  // Step 3: Try phonetic token matching (fuzzy search)
  const { generateSearchTokens } = await import('../../adapters/utils/phonetic-helper');
  const tokens = generateSearchTokens(normalizedName);

  if (tokens.length > 0) {
    const phoneticMatches = await repo.searchTrusteesByPhoneticTokens(tokens);

    if (phoneticMatches.length === 1) {
      context.logger.info(
        MODULE_NAME,
        `FALLBACK: Found trustee by phonetic tokens: "${normalizedName}" -> ${phoneticMatches[0].trusteeId}`,
      );
      return phoneticMatches[0];
    }

    if (phoneticMatches.length > 1 && zoomEmail) {
      const normalizedZoomEmail = normalizeEmail(zoomEmail);
      const emailFiltered = phoneticMatches.filter((t) => {
        const trusteeEmail = normalizeEmail(t.public.email);
        return trusteeEmail === normalizedZoomEmail;
      });

      if (emailFiltered.length === 1) {
        context.logger.info(
          MODULE_NAME,
          `FALLBACK: Found trustee by phonetic tokens + email: "${normalizedName}" -> ${emailFiltered[0].trusteeId}`,
        );
        return emailFiltered[0];
      }
    }

    if (phoneticMatches.length > 1) {
      context.logger.warn(
        MODULE_NAME,
        `FALLBACK: Multiple trustees found by phonetic search for "${normalizedName}", cannot disambiguate`,
      );
    }
  }

  context.logger.info(
    MODULE_NAME,
    `FALLBACK: No trustee found for name "${normalizedName}" after trying all strategies`,
  );
  return null;
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
    const camsTrustees: Trustee[] = [];
    const notFoundIds: string[] = [];

    for (const atsTruId of atsTruIds) {
      const trustee = await repo.findTrusteeByLegacyTruId(atsTruId);
      if (trustee) {
        camsTrustees.push(trustee);
      } else {
        notFoundIds.push(atsTruId);
      }
    }

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

    // If multiple ATS trustees mapped to the same zoom, we need to decide which one to update
    // For now, update the first one and log a warning
    const targetTrustee = camsTrustees[0];

    if (camsTrustees.length > 1) {
      context.logger.warn(
        MODULE_NAME,
        `Multiple CAMS trustees found for zoom "${row.zoomName}": ${camsTrustees.map((t) => t.trusteeId).join(', ')}. Updating first trustee: ${targetTrustee.trusteeId}`,
      );
    }

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
  const result: ZoomImportResult = { total: 0, matched: 0, unmatched: 0, ambiguous: 0, errors: 0 };

  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, ZOOM_MATCHED_TSV_BLOB_NAME);

  if (!content) {
    context.logger.info(
      MODULE_NAME,
      'No zoom matching report found in object storage — skipping import',
    );
    return result;
  }

  const rows = parseZoomMatchedTsvFile(content);
  result.total = rows.length;

  const reportLines: string[] = [ZOOM_REPORT_HEADERS];
  const unmatchedRows: ZoomMatchedRow[] = [];

  for (const row of rows) {
    const processResult = await processZoomMatchedRow(context, row);
    result[
      processResult.outcome === 'matched'
        ? 'matched'
        : processResult.outcome === 'unmatched'
          ? 'unmatched'
          : processResult.outcome === 'ambiguous'
            ? 'ambiguous'
            : 'errors'
    ]++;

    // Collect unmatched rows for separate report
    if (processResult.outcome === 'unmatched') {
      unmatchedRows.push(row);
    }

    reportLines.push(
      [
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
      ].join('\t'),
    );
  }

  context.logger.info(MODULE_NAME, `Import complete: ${JSON.stringify(result)}`);

  await objectStorage.writeObject(containerName, ZOOM_REPORT_BLOB_NAME, reportLines.join('\n'));
  context.logger.info(MODULE_NAME, `Report saved to ${containerName}/${ZOOM_REPORT_BLOB_NAME}`);

  // Write unmatched report
  if (unmatchedRows.length > 0) {
    const unmatchedReportLines: string[] = [
      'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates',
    ];

    for (const row of unmatchedRows) {
      unmatchedReportLines.push(
        [
          row.zoomName,
          row.zoomEmail,
          row.meetingId,
          row.passcode,
          row.phone,
          row.link,
          row.outcome,
          row.strategy,
          row.atsTruIds,
          row.matchedNames,
          row.matchCount,
          row.similarity,
          row.activeStatus,
          row.statusCodes,
          row.ambiguousCandidates,
        ].join('\t'),
      );
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
