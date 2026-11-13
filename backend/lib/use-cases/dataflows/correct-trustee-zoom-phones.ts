import { PHONE_REGEX } from '@common/cams/regex';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { BASE_DELAY_MS, retryOnRateLimit } from './dataflow-backoff';
import { DEFAULT_INVOCATION_BUDGET_MS } from './invocation-budget';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'CORRECT-TRUSTEE-ZOOM-PHONES-USE-CASE';

export type ZoomPhoneConversion =
  | { outcome: 'alreadyValid' }
  | { outcome: 'converted'; newValue: string }
  | { outcome: 'flagged'; reason: string };

const EXTENSION_SUFFIX = /^(.*?)\s*(?:x|ext\.?|extension[:.]?)\s*(\d+)$/i;
const NUMBER_PART_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * One-time migration rule for Zoom phones the Zoom Info Import stored
 * without validation, e.g. "(680) 214-4529". Converts what can be unambiguously
 * reformatted to PHONE_REGEX and flags everything else for review.
 */
export function convertZoomPhone(stored: string | undefined): ZoomPhoneConversion {
  const trimmed = stored?.trim() ?? '';
  if (!trimmed) {
    return { outcome: 'flagged', reason: 'Zoom phone is empty or missing.' };
  }
  if (stored === trimmed && PHONE_REGEX.test(trimmed)) {
    return { outcome: 'alreadyValid' };
  }

  const extensionMatch = EXTENSION_SUFFIX.exec(trimmed);
  const numberPart = extensionMatch ? extensionMatch[1] : trimmed;
  const extension = extensionMatch ? extensionMatch[2] : undefined;

  if (!NUMBER_PART_CHARACTERS.test(numberPart)) {
    return { outcome: 'flagged', reason: 'Zoom phone contains unexpected characters.' };
  }

  const digits = numberPart.replace(/\D/g, '');
  let formatted: string;
  if (digits.length === 10) {
    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    formatted = `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else {
    return { outcome: 'flagged', reason: `Zoom phone has ${digits.length} digits.` };
  }

  const newValue = extension ? `${formatted} x${extension}` : formatted;
  if (!PHONE_REGEX.test(newValue)) {
    return { outcome: 'flagged', reason: 'Converted Zoom phone does not match the phone format.' };
  }
  return { outcome: 'converted', newValue };
}

type ZoomPhoneCorrectionOutcome = 'converted' | 'alreadyValid' | 'flagged' | 'failed';

type ZoomPhoneCorrectionResult = {
  trusteeId: string;
  outcome: ZoomPhoneCorrectionOutcome;
  newValue?: string;
  reason?: string;
  error?: string;
  // Carried on flagged results so the review report identifies the trustee and the bad value.
  trusteeName?: string;
  storedPhone?: string;
};

type ZoomPhoneCorrectionSummary = {
  results: ZoomPhoneCorrectionResult[];
  counts: Record<ZoomPhoneCorrectionOutcome, number>;
};

/**
 * What a continuation carries between invocations. Each pass re-reads the trustees, so
 * trustees converted earlier already show as valid; only their count has to be carried.
 */
export type CorrectionState = { converted: number };

export const INITIAL_CORRECTION_STATE: CorrectionState = { converted: 0 };

type CorrectionPassOptions = {
  startedAt?: number;
  safeThresholdMs?: number;
  baseDelayMs?: number;
};

export type CorrectionPassOutcome =
  | { kind: 'complete'; summary: ZoomPhoneCorrectionSummary }
  | { kind: 'escape'; state: CorrectionState; backoffSeconds: number };

/**
 * One pass over every trustee with Zoom info. Rate limited (429) reads and writes back off and
 * retry in place. When the next backoff would not fit in the invocation budget, the pass stops
 * with `escape` and the state a continuation needs to resume; the next pass finds the remaining
 * work by re-reading. A write that fails for any other reason is recorded as failed and the pass
 * moves on.
 *
 * Writes go through the repository setter only. This deliberately does not go through
 * TrusteesUseCase, so no trustee history or change notification is produced.
 */
async function runCorrectionPass(
  context: ApplicationContext,
  state: CorrectionState,
  options: CorrectionPassOptions = {},
): Promise<MaybeData<CorrectionPassOutcome>> {
  const {
    startedAt = Date.now(),
    safeThresholdMs = DEFAULT_INVOCATION_BUDGET_MS,
    baseDelayMs = BASE_DELAY_MS,
  } = options;
  const { logger } = context;
  const retryOptions = (description: string) => ({
    startedAt,
    safeThresholdMs,
    baseDelayMs,
    onBackoff: (attempt: number, backoffMs: number) =>
      logger.info(
        MODULE_NAME,
        `RU-throttled ${description} (attempt ${attempt}) — backing off ${backoffMs}ms before retry.`,
      ),
  });

  try {
    const repo = factory.getTrusteesRepository(context);

    const read = await retryOnRateLimit(
      () => repo.listTrustees(),
      retryOptions('reading trustees'),
    );
    if (read.kind === 'escape') {
      return { data: escapeOutcome(state, 0, read.backoffMs) };
    }

    const results: ZoomPhoneCorrectionResult[] = [];
    let convertedThisPass = 0;

    for (const trustee of read.value.filter((t) => !!t.zoomInfo)) {
      const { trusteeId } = trustee;
      const conversion = convertZoomPhone(trustee.zoomInfo?.phone);

      if (conversion.outcome === 'alreadyValid') {
        results.push({ trusteeId, outcome: 'alreadyValid' });
      } else if (conversion.outcome === 'flagged') {
        results.push({
          trusteeId,
          outcome: 'flagged',
          reason: conversion.reason,
          trusteeName: trustee.name,
          storedPhone: trustee.zoomInfo?.phone,
        });
      } else {
        const { newValue } = conversion;
        try {
          const write = await retryOnRateLimit(
            () => repo.setZoomInfo(trusteeId, { ...trustee.zoomInfo, phone: newValue }),
            retryOptions(`writing trustee ${trusteeId}`),
          );
          if (write.kind === 'escape') {
            return { data: escapeOutcome(state, convertedThisPass, write.backoffMs) };
          }
          convertedThisPass++;
          results.push({ trusteeId, outcome: 'converted', newValue });
        } catch (originalError) {
          results.push({
            trusteeId,
            outcome: 'failed',
            newValue,
            error: originalError instanceof Error ? originalError.message : String(originalError),
          });
        }
      }
    }

    return { data: { kind: 'complete', summary: summarize(results, state.converted) } };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to correct trustee Zoom phones.'),
    };
  }
}

function escapeOutcome(
  state: CorrectionState,
  convertedThisPass: number,
  backoffMs: number,
): CorrectionPassOutcome {
  return {
    kind: 'escape',
    state: { converted: state.converted + convertedThisPass },
    backoffSeconds: Math.ceil(backoffMs / 1000),
  };
}

/**
 * Trustees converted by earlier passes read as already valid now, so they move from the
 * already-valid count back to converted.
 */
function summarize(
  results: ZoomPhoneCorrectionResult[],
  convertedEarlier: number,
): ZoomPhoneCorrectionSummary {
  const counts = { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 };
  results.forEach((result) => counts[result.outcome]++);
  const reclassified = Math.min(convertedEarlier, counts.alreadyValid);
  counts.converted += reclassified;
  counts.alreadyValid -= reclassified;
  return { results, counts };
}

const FLAGGED_REPORT_BLOB_NAME = 'correct-trustee-zoom-phones-flagged.csv';
const FLAGGED_REPORT_HEADERS = 'trusteeId,trusteeName,storedPhone,reason';

// A cell starting with one of these is read as a formula by spreadsheet software, and the
// stored phone is arbitrary bad data.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: string | undefined): string {
  const text = value ?? '';
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Records the trustees whose Zoom phone could not be converted safely as a CSV in object
 * storage, for a person to review in CAMS. The file is overwritten on every run, and is written
 * with only the header when nothing is flagged so a report from an earlier run cannot be
 * mistaken for this one. Returns the container-qualified blob name.
 */
async function writeFlaggedReport(
  context: ApplicationContext,
  results: ZoomPhoneCorrectionResult[],
): Promise<string> {
  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  const rows = results
    .filter((result) => result.outcome === 'flagged')
    .map((result) =>
      [result.trusteeId, result.trusteeName, result.storedPhone, result.reason]
        .map(csvCell)
        .join(','),
    );
  await factory
    .getObjectStorageGateway(context)
    .writeObject(
      containerName,
      FLAGGED_REPORT_BLOB_NAME,
      [FLAGGED_REPORT_HEADERS, ...rows].join('\n'),
    );
  return `${containerName}/${FLAGGED_REPORT_BLOB_NAME}`;
}

const CorrectTrusteeZoomPhones = {
  runCorrectionPass,
  writeFlaggedReport,
};

export default CorrectTrusteeZoomPhones;
