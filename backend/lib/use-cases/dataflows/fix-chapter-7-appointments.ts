import { ApplicationContext } from '../../adapters/types/basic';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import factory from '../../factory';

const MODULE_NAME = 'FIX-CHAPTER-7-APPOINTMENTS-USE-CASE';

export type AppointmentIdPair = { trusteeApptId: string; caseApptId: string | null };

// Azure Function execution budget (matches host.json functionTimeout of 01:00:00).
// Used as the upper bound for runReaderLoop's escape hatch calculation.
// 4-minute safety buffer: 60 min - 4 min = 56 min. Mirrors the same
// timeout/buffer ratio used by migrate-case-appointments.
const SAFE_THRESHOLD_MS = 56 * 60 * 1000;

const BASE_DELAY_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function computeNextBackoffMs(attempt: number, baseDelayMs: number): number {
  return Math.min(Math.pow(2, attempt + 1) * baseDelayMs, MAX_BACKOFF_MS);
}

function shouldEscape(startedAt: number, safeThresholdMs: number, nextDelayMs: number): boolean {
  return Date.now() - startedAt + nextDelayMs >= safeThresholdMs;
}

/**
 * readIdPairs — thin wrapper delegating to the repository's
 * findAppointmentIdPairsByChapter. No cursor/state — caller re-queries fresh
 * each invocation; matched documents naturally drop out of the next query
 * once fixed.
 */
async function readIdPairs(
  context: ApplicationContext,
  matchChapter: string,
  limit: number,
): Promise<AppointmentIdPair[]> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.findAppointmentIdPairsByChapter(matchChapter, limit);
}

/**
 * applyFix — thin wrapper delegating to the repository's applyChapterFix.
 */
async function applyFix(
  context: ApplicationContext,
  idPairs: AppointmentIdPair[],
  operation: 'rename' | 'delete',
  matchChapter: string,
  setChapter?: string,
): Promise<{ modifiedCount: number }> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.applyChapterFix(idPairs, operation, matchChapter, setChapter);
}

type RunReaderLoopResult = {
  totalModified: number;
  streamComplete: boolean;
  // Set only when the escape hatch fires: the batch read this iteration but
  // not yet (fully) applied. The caller is responsible for dumping this to
  // the writer queue rather than losing it.
  unwrittenIdPairs: AppointmentIdPair[];
  // Wall-clock seconds the caller should wait before re-enqueueing the reader
  // continuation — non-zero only when the escape hatch fired due to RU
  // throttling (mirrors the backoff the loop itself was about to sleep for).
  recommendedVisibilitySeconds: number;
};

/**
 * runReaderLoop — default execution mode for this dataflow: read a batch of
 * matching id pairs, apply the fix to both partitions directly (bypassing the
 * writer queue), and repeat until either the stream is drained (an empty read)
 * or the escape hatch fires.
 *
 * Escape hatch: before each read AND before retrying after a 429, checks
 * whether wall-clock elapsed since startedAt plus the next step's expected
 * delay would exceed safeThresholdMs. If so, stops immediately and returns
 * whatever was read-but-not-yet-applied this iteration as unwrittenIdPairs —
 * the caller (handleReader) is expected to send that batch to the writer
 * queue as a fallback and re-enqueue a plain reader continuation. This keeps
 * the invocation safely within the Azure Functions execution timeout (see
 * SAFE_THRESHOLD_MS) regardless of how much RU throttling is encountered.
 *
 * On 429/RU-throttling (read or write), retries in place with exponential
 * backoff (mirrors migrate-case-appointments' writePage) rather than
 * round-tripping through a queue — cheaper and faster than the old
 * reader/writer-queue split for the common case where Cosmos recovers
 * quickly.
 */
async function runReaderLoop(
  context: ApplicationContext,
  matchChapter: string,
  operation: 'rename' | 'delete',
  setChapter: string | undefined,
  batchSize: number,
  options: { startedAt?: number; safeThresholdMs?: number; baseDelayMs?: number } = {},
): Promise<RunReaderLoopResult> {
  const {
    startedAt = Date.now(),
    safeThresholdMs = SAFE_THRESHOLD_MS,
    baseDelayMs = BASE_DELAY_MS,
  } = options;
  const { logger } = context;
  const logPrefix = `operation=${operation} matchChapter=${matchChapter}`;

  let totalModified = 0;
  let iteration = 0;

  while (true) {
    iteration++;

    if (shouldEscape(startedAt, safeThresholdMs, 0)) {
      logger.info(
        MODULE_NAME,
        `${logPrefix} iteration=${iteration}: escape hatch (elapsed budget) before read — totalModified=${totalModified}`,
      );
      return {
        totalModified,
        streamComplete: false,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      };
    }

    const idPairs = await readWithRetry(
      context,
      matchChapter,
      batchSize,
      startedAt,
      safeThresholdMs,
      baseDelayMs,
    );

    if (idPairs.kind === 'escape') {
      logger.info(
        MODULE_NAME,
        `${logPrefix} iteration=${iteration}: escape hatch (RU-throttled read) — totalModified=${totalModified}`,
      );
      return {
        totalModified,
        streamComplete: false,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: Math.ceil(idPairs.backoffMs / 1000),
      };
    }

    if (idPairs.idPairs.length === 0) {
      logger.info(
        MODULE_NAME,
        `${logPrefix} iteration=${iteration}: read returned 0 id pairs — stream complete, totalModified=${totalModified}`,
      );
      return {
        totalModified,
        streamComplete: true,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      };
    }

    const writeResult = await applyWithRetry(
      context,
      idPairs.idPairs,
      operation,
      matchChapter,
      setChapter,
      startedAt,
      safeThresholdMs,
      baseDelayMs,
    );

    if (writeResult.kind === 'escape') {
      logger.info(
        MODULE_NAME,
        `${logPrefix} iteration=${iteration}: escape hatch (RU-throttled write) — ${idPairs.idPairs.length} id pair(s) unwritten, totalModified=${totalModified}`,
      );
      return {
        totalModified,
        streamComplete: false,
        unwrittenIdPairs: idPairs.idPairs,
        recommendedVisibilitySeconds: Math.ceil(writeResult.backoffMs / 1000),
      };
    }

    totalModified += writeResult.modifiedCount;
    logger.info(
      MODULE_NAME,
      `${logPrefix} iteration=${iteration}: wrote ${writeResult.modifiedCount} of ${idPairs.idPairs.length} id pair(s) — totalModified=${totalModified}, elapsedMs=${Date.now() - startedAt}`,
    );
  }
}

async function readWithRetry(
  context: ApplicationContext,
  matchChapter: string,
  batchSize: number,
  startedAt: number,
  safeThresholdMs: number,
  baseDelayMs: number,
): Promise<{ kind: 'read'; idPairs: AppointmentIdPair[] } | { kind: 'escape'; backoffMs: number }> {
  const { logger } = context;
  let attempt = 0;

  while (true) {
    try {
      const idPairs = await readIdPairs(context, matchChapter, batchSize);
      return { kind: 'read', idPairs };
    } catch (error) {
      if (!isTooManyRequestsError(error)) throw error;

      const nextBackoffMs = computeNextBackoffMs(attempt, baseDelayMs);
      if (shouldEscape(startedAt, safeThresholdMs, nextBackoffMs)) {
        return { kind: 'escape', backoffMs: nextBackoffMs };
      }
      logger.info(
        MODULE_NAME,
        `matchChapter=${matchChapter}: RU-throttled on read (attempt ${attempt + 1}) — backing off ${nextBackoffMs}ms before retry.`,
      );
      await sleep(nextBackoffMs);
      attempt++;
    }
  }
}

async function applyWithRetry(
  context: ApplicationContext,
  idPairs: AppointmentIdPair[],
  operation: 'rename' | 'delete',
  matchChapter: string,
  setChapter: string | undefined,
  startedAt: number,
  safeThresholdMs: number,
  baseDelayMs: number,
): Promise<{ kind: 'written'; modifiedCount: number } | { kind: 'escape'; backoffMs: number }> {
  const { logger } = context;
  let attempt = 0;

  while (true) {
    try {
      const result = await applyFix(context, idPairs, operation, matchChapter, setChapter);
      return { kind: 'written', modifiedCount: result.modifiedCount };
    } catch (error) {
      if (!isTooManyRequestsError(error)) throw error;

      const nextBackoffMs = computeNextBackoffMs(attempt, baseDelayMs);
      if (shouldEscape(startedAt, safeThresholdMs, nextBackoffMs)) {
        return { kind: 'escape', backoffMs: nextBackoffMs };
      }
      logger.info(
        MODULE_NAME,
        `operation=${operation} matchChapter=${matchChapter}: RU-throttled on write of ${idPairs.length} id pair(s) (attempt ${attempt + 1}) — backing off ${nextBackoffMs}ms before retry.`,
      );
      await sleep(nextBackoffMs);
      attempt++;
    }
  }
}

const FixChapter7AppointmentsUseCase = {
  readIdPairs,
  applyFix,
  runReaderLoop,
};

export default FixChapter7AppointmentsUseCase;
