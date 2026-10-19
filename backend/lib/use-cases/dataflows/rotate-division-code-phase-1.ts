import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { MaybeData } from './queue-types';
import {
  DIVISION_CODE_ROTATION_COLLECTIONS,
  DivisionCodeRotationCollection,
  DivisionCodeRotationPhase1State,
  UpdateResult,
} from '../gateways.types';
import { SyncedCase } from '@common/cams/cases';

const MODULE_NAME = 'ROTATE-DIVISION-CODE-PHASE-1-USE-CASE';
const STATE_DOCUMENT_TYPE = 'DIVISION_CODE_ROTATION_PHASE_1_STATE';

const { and, using } = QueryBuilder;

const OLD_FIELD = 'ustDivisionCode';
const NEW_FIELD = 'tempCourtDivisionCode';

/**
 * CAMS-936 Phase 1 of the division-code name rotation: move the per-court-unique value off
 * `ustDivisionCode` and onto `tempCourtDivisionCode`, so Phase 2 can reuse the vacated name for the
 * legacy ACMS value without a field name ever meaning two things at once.
 *
 * Three document states, and what this job does with each:
 *
 *   `ustDivisionCode` only        historical    -> $rename to `tempCourtDivisionCode`
 *   both field names              see D7        -> $unset `ustDivisionCode` (values are equal here)
 *   `tempCourtDivisionCode` only  synced since  -> never selected, never touched
 *                                 Task 1 shipped
 *
 * Selecting on `ustDivisionCode` existing is what makes the job idempotent: a migrated document
 * drops out of the page query, so a second run finds nothing. No backup fields are needed —
 * `$rename` moves rather than copies, so rolling the phase back is renaming back.
 */

type RotationDocument = {
  _id: string;
  ustDivisionCode?: string;
  tempCourtDivisionCode?: string;
};

export type StartRotationOptions = {
  dryRun?: boolean;
};

export type StartRotationResult =
  | { status: 'error'; error: CamsError }
  | { status: 'completed'; state: DivisionCodeRotationPhase1State }
  | { status: 'started'; dryRun: boolean };

export type ProcessRotationPageResult =
  | { status: 'error'; error: CamsError }
  | {
      status: 'ok';
      collection: DivisionCodeRotationCollection;
      hasMore: boolean;
      processed: number;
      renamed: number;
      unset: number;
    };

/**
 * Per-collection read and write access. The two collections differ only in how a page is read —
 * `cases` has a generic cursor finder, `trustee-match-verification` exposes a narrow one — so the
 * page-processing logic below stays collection-agnostic.
 */
type CollectionHandle = {
  page(
    context: ApplicationContext,
    lastId: string | null,
    limit: number,
  ): Promise<RotationDocument[]>;
  write(context: ApplicationContext, ids: string[], update: object): Promise<UpdateResult>;
};

type SyncedCaseQueryable = SyncedCase & { _id: string };

const HANDLES: Record<DivisionCodeRotationCollection, CollectionHandle> = {
  cases: {
    async page(context, lastId, limit) {
      const doc = using<SyncedCaseQueryable>();
      const conditions = [doc('documentType').equals('SYNCED_CASE'), doc(OLD_FIELD).exists()];
      if (lastId) conditions.push(doc('_id').greaterThan(lastId));
      return (await factory
        .getCasesRepository(context)
        .findByCursor<SyncedCaseQueryable>(and(...conditions), {
          limit,
          sortField: '_id',
          sortDirection: 'ASCENDING',
        })) as RotationDocument[];
    },
    async write(context, ids, update) {
      return factory
        .getCasesRepository(context)
        .updateManyByQuery(buildWriteQuery(ids, isRename(update)), update);
    },
  },
  'trustee-match-verification': {
    async page(context, lastId, limit) {
      return (await factory
        .getTrusteeMatchVerificationRepository(context)
        .findVerificationsWithUstDivisionCode(lastId, limit)) as RotationDocument[];
    },
    async write(context, ids, update) {
      return factory
        .getTrusteeMatchVerificationRepository(context)
        .updateManyByQuery(buildWriteQuery(ids, isRename(update)), update);
    },
  },
};

function isRename(update: object): boolean {
  return Object.keys(update)[0] === '$rename';
}

/**
 * Re-asserts the document state the page read observed, because the read and the write are not
 * atomic: a DXTR sync between them can populate `tempCourtDivisionCode` on a document this page
 * classified as needing a rename. Without the destination condition, `$rename` would overwrite
 * that freshly-synced value with the stale one — the only way this job can lose data.
 *
 * Built against `RotationDocument` rather than each collection's full type: only the three fields
 * below are referenced, and the renderer needs names, not the surrounding document shape.
 */
function buildWriteQuery(ids: string[], isRename: boolean) {
  const doc = using<RotationDocument>();
  return and(
    doc('_id').contains(ids),
    doc(OLD_FIELD).exists(),
    isRename ? doc(NEW_FIELD).notExists() : doc(NEW_FIELD).exists(),
  );
}

async function readRotationState(
  context: ApplicationContext,
): Promise<MaybeData<DivisionCodeRotationPhase1State | null>> {
  try {
    const repo = factory.getDivisionCodeRotationPhase1StateRepo(context);
    const state = await repo.read(STATE_DOCUMENT_TYPE);
    return { data: state };
  } catch (originalError) {
    // A first run has no state document; that is not an error.
    if (isNotFoundError(originalError)) return { data: null };
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read rotation state.'),
    };
  }
}

async function writeRotationState(
  context: ApplicationContext,
  state: DivisionCodeRotationPhase1State,
): Promise<MaybeData<DivisionCodeRotationPhase1State>> {
  try {
    const repo = factory.getDivisionCodeRotationPhase1StateRepo(context);
    const saved = await repo.upsert({ ...state, lastUpdatedAt: new Date().toISOString() });
    return { data: saved };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to write rotation state.'),
    };
  }
}

function nextCollection(
  current: DivisionCodeRotationCollection,
): DivisionCodeRotationCollection | null {
  const index = DIVISION_CODE_ROTATION_COLLECTIONS.indexOf(current);
  return DIVISION_CODE_ROTATION_COLLECTIONS[index + 1] ?? null;
}

/**
 * Starts or resumes a rotation. Dry run is the default: a real run requires `dryRun: false`, the
 * same gating the appointment backfill uses. A completed real run is never repeated — delete its
 * state document to force one.
 */
async function startRotation(
  context: ApplicationContext,
  options: StartRotationOptions,
): Promise<StartRotationResult> {
  const stateResult = await readRotationState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };

  const existing = stateResult.data;
  if (existing?.status === 'IN_PROGRESS') {
    return { status: 'started', dryRun: existing.dryRun };
  }
  if (existing && !existing.dryRun) {
    return { status: 'completed', state: existing };
  }

  const dryRun = options.dryRun ?? true;
  const now = new Date().toISOString();
  const writeResult = await writeRotationState(context, {
    ...(existing?.id ? { id: existing.id } : {}),
    documentType: STATE_DOCUMENT_TYPE,
    currentCollection: DIVISION_CODE_ROTATION_COLLECTIONS[0],
    lastId: null,
    dryRun,
    processedCount: 0,
    renamedCount: 0,
    unsetCount: 0,
    startedAt: now,
    lastUpdatedAt: now,
    status: 'IN_PROGRESS',
  });
  if (writeResult.error) return { status: 'error', error: writeResult.error as CamsError };

  return { status: 'started', dryRun };
}

/**
 * Processes one page of the collection the state document currently points at. Reading `limit + 1`
 * documents is the lookahead that decides `hasMore` without a second query.
 *
 * Each page is at most two bulk writes rather than one write per document. `$rename` and `$unset`
 * cannot both target `ustDivisionCode` in a single update document — Mongo rejects conflicting
 * paths — so the page is partitioned and written in two calls.
 */
async function processRotationPage(
  context: ApplicationContext,
  pageSize: number,
): Promise<ProcessRotationPageResult> {
  const stateResult = await readRotationState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };

  const state = stateResult.data;
  if (!state) {
    return {
      status: 'error',
      error: getCamsError(
        new Error('No rotation has been started.'),
        MODULE_NAME,
        'No rotation state document exists. Send a start message first.',
      ),
    };
  }

  const collection = state.currentCollection;
  const handle = HANDLES[collection];

  let documents: RotationDocument[];
  try {
    documents = await handle.page(context, state.lastId, pageSize + 1);
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to read a page of ${collection} (lastId: ${state.lastId}).`,
      ),
    };
  }

  if (documents.length === 0) {
    const advanceTo = nextCollection(collection);
    const writeResult = await writeRotationState(context, {
      ...state,
      currentCollection: advanceTo ?? collection,
      // The cursor is an _id within one collection; carrying it across would skip documents.
      lastId: advanceTo ? null : state.lastId,
      status: advanceTo ? 'IN_PROGRESS' : 'COMPLETED',
    });
    if (writeResult.error) return { status: 'error', error: writeResult.error as CamsError };

    context.logger.info(
      MODULE_NAME,
      advanceTo
        ? `${collection} has no documents left carrying ${OLD_FIELD}; advancing to ${advanceTo}.`
        : `Rotation complete. Processed ${state.processedCount}, renamed ${state.renamedCount}, ` +
            `unset ${state.unsetCount}.`,
    );
    return { status: 'ok', collection, hasMore: !!advanceTo, processed: 0, renamed: 0, unset: 0 };
  }

  const hasMoreInCollection = documents.length > pageSize;
  const page = documents.slice(0, pageSize);
  const renameIds = page.filter((doc) => !doc.tempCourtDivisionCode).map((doc) => doc._id);
  const unsetIds = page.filter((doc) => !!doc.tempCourtDivisionCode).map((doc) => doc._id);

  if (!state.dryRun) {
    try {
      if (renameIds.length > 0) {
        const result = await handle.write(context, renameIds, {
          $rename: { [OLD_FIELD]: NEW_FIELD },
        });
        warnOnPartialWrite(context, collection, '$rename', result);
      }
      if (unsetIds.length > 0) {
        const result = await handle.write(context, unsetIds, { $unset: { [OLD_FIELD]: '' } });
        warnOnPartialWrite(context, collection, '$unset', result);
      }
    } catch (originalError) {
      return {
        status: 'error',
        error: getCamsError(
          originalError,
          MODULE_NAME,
          `Failed to rotate a page of ${collection}.`,
        ),
      };
    }
  }

  const writeResult = await writeRotationState(context, {
    ...state,
    lastId: page[page.length - 1]._id,
    processedCount: state.processedCount + page.length,
    renamedCount: state.renamedCount + renameIds.length,
    unsetCount: state.unsetCount + unsetIds.length,
  });
  if (writeResult.error) return { status: 'error', error: writeResult.error as CamsError };

  context.logger.debug(
    MODULE_NAME,
    `${state.dryRun ? 'Would rotate' : 'Rotated'} ${page.length} ${collection} document(s): ` +
      `${renameIds.length} renamed, ${unsetIds.length} unset.`,
  );

  return {
    status: 'ok',
    collection,
    hasMore: hasMoreInCollection || !!nextCollection(collection),
    processed: page.length,
    renamed: renameIds.length,
    unset: unsetIds.length,
  };
}

/**
 * A gap between matched and modified means documents matched the `_id` set but not the field
 * conditions — i.e. a concurrent sync changed them between the read and the write. Expected to be
 * zero; worth surfacing because it is the signal that the read/write race actually fired.
 */
function warnOnPartialWrite(
  context: ApplicationContext,
  collection: DivisionCodeRotationCollection,
  operator: string,
  result: UpdateResult,
) {
  if (result.modifiedCount !== result.matchedCount) {
    context.logger.warn(
      MODULE_NAME,
      `${collection}: ${operator} matched ${result.matchedCount} document(s) but modified ` +
        `${result.modifiedCount}. A concurrent sync may have changed them mid-page.`,
    );
  }
}

const RotateDivisionCodePhase1UseCase = {
  startRotation,
  processRotationPage,
  readRotationState,
};

export default RotateDivisionCodePhase1UseCase;
