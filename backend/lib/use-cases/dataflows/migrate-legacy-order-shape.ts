import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ConsolidationOrder, TransferOrder } from '@common/cams/orders';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { MaybeData } from './queue-types';
import QueryBuilder from '../../query/query-builder';

const { using } = QueryBuilder;

const MODULE_NAME = 'MIGRATE-LEGACY-ORDER-SHAPE-USE-CASE';

export type OrderKind = 'transfer' | 'consolidation' | 'trustee-match';

type LegacyOrder = (TransferOrder | ConsolidationOrder | TrusteeMatchVerification) & {
  _id: string;
  orderType?: string;
  orderDate?: string;
  createdOn?: string;
  updatedOn?: string;
};

// Legacy documents haven't had `taskType` set yet, so `computeTaskDate` (which
// dispatches on `taskType`) can't be trusted here — orders/consolidations derive
// taskDate from orderDate, but trustee-match-verification has no orderDate at all
// and instead falls back to createdOn/updatedOn (see computeTaskDate's 'trustee-match'
// branch in @common/cams/data-verification, mirrored here for the legacy-shaped path).
function computeLegacyTaskDate(kind: OrderKind, order: LegacyOrder): string {
  if (kind === 'trustee-match') {
    const date = order.createdOn ?? order.updatedOn;
    return date ?? '';
  }
  return order.orderDate ?? '';
}

type MigrationResult = {
  id: string;
  success: boolean;
  error?: string;
};

type CursorPageResult = {
  orders: LegacyOrder[];
  lastId: string | null;
  hasMore: boolean;
};

type ProcessMigrationPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      failedResults: MigrationResult[];
      nextCursor: { lastId: string | null } | null;
    };

function getRepo(context: ApplicationContext, kind: OrderKind) {
  if (kind === 'transfer') {
    return factory.getOrdersRepository(context);
  }
  if (kind === 'consolidation') {
    return factory.getConsolidationOrdersRepository(context);
  }
  return factory.getTrusteeMatchVerificationRepository(context);
}

async function countLegacyOrders(context: ApplicationContext, kind: OrderKind): Promise<number> {
  const repo = getRepo(context, kind);
  return repo.countOrdersWithLegacyShape();
}

async function getPageNeedingMigration(
  context: ApplicationContext,
  kind: OrderKind,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<CursorPageResult>> {
  try {
    const repo = getRepo(context, kind);
    const results = (await repo.findOrdersWithLegacyShape(lastId, limit + 1)) as LegacyOrder[];

    const hasMore = results.length > limit;
    const orders = results.slice(0, limit);
    const newLastId = orders.length > 0 ? orders[orders.length - 1]._id : null;

    return { data: { orders, lastId: newLastId, hasMore } };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of ${kind} orders with legacy shape (lastId: ${lastId}).`,
      ),
    };
  }
}

async function migrateOrders(
  context: ApplicationContext,
  kind: OrderKind,
  orders: LegacyOrder[],
): Promise<MaybeData<MigrationResult[]>> {
  const results: MigrationResult[] = [];
  const repo = getRepo(context, kind);

  for (const order of orders) {
    try {
      const taskDate = computeLegacyTaskDate(kind, order);
      if (!taskDate) {
        context.logger.warn(
          MODULE_NAME,
          `Unable to compute taskDate for ${kind} order ${order._id} — skipping.`,
        );
        results.push({ id: order._id, success: false, error: 'Unable to compute taskDate' });
        continue;
      }

      const query = using<LegacyOrder>()('_id').equals(order._id);
      await repo.updateManyByQuery(query, {
        $rename: { orderType: 'taskType' },
        $set: { taskDate },
      });
      results.push({ id: order._id, success: true });
    } catch (originalError) {
      results.push({
        id: order._id,
        success: false,
        error: originalError instanceof Error ? originalError.message : String(originalError),
      });
    }
  }

  return { data: results };
}

async function processMigrationPage(
  context: ApplicationContext,
  kind: OrderKind,
  lastId: string | null,
  pageSize: number,
): Promise<ProcessMigrationPageResult> {
  const pageResult = await getPageNeedingMigration(context, kind, lastId, pageSize);
  if (pageResult.error || !pageResult.data) {
    return {
      status: 'error',
      error:
        (pageResult.error as CamsError) ??
        getCamsError(new Error('Unexpected missing data in page result'), MODULE_NAME),
    };
  }

  const { orders, lastId: newLastId, hasMore } = pageResult.data;

  if (orders.length === 0) {
    return { status: 'empty' };
  }

  const migrationResult = await migrateOrders(context, kind, orders);
  if (migrationResult.error) {
    return { status: 'error', error: migrationResult.error as CamsError };
  }

  const results = migrationResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return {
    status: 'ok',
    processedCount: results.length,
    successCount,
    failedResults,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

const MigrateLegacyOrderShapeUseCase = {
  getPageNeedingMigration,
  migrateOrders,
  processMigrationPage,
  countLegacyOrders,
};

export default MigrateLegacyOrderShapeUseCase;
