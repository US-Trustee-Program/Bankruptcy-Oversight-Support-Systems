import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TransferOrder } from '@common/cams/orders';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'BACKFILL-TRANSFER-ORDER-TASK-DATE-USE-CASE';

type BackfillTransferOrder = TransferOrder & { _id: string };

type CursorPageResult = {
  orders: BackfillTransferOrder[];
  lastId: string | null;
  hasMore: boolean;
};

type BackfillResult = {
  id: string;
  success: boolean;
  error?: string;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      newLastId: string | null;
      failedResults: BackfillResult[];
      nextCursor: { lastId: string | null } | null;
    };

async function getPageNeedingBackfill(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<CursorPageResult>> {
  try {
    const repo = factory.getOrdersRepository(context);
    const results = await repo.findTransferOrdersMissingTaskDate(lastId, limit + 1);

    const hasMore = results.length > limit;
    const orders = results.slice(0, limit) as BackfillTransferOrder[];
    const newLastId = orders.length > 0 ? orders[orders.length - 1]._id : null;

    return { data: { orders, lastId: newLastId, hasMore } };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of transfer orders needing taskDate backfill (lastId: ${lastId}).`,
      ),
    };
  }
}

async function backfillTaskDates(
  context: ApplicationContext,
  orders: BackfillTransferOrder[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];
  const repo = factory.getOrdersRepository(context);

  for (const order of orders) {
    try {
      if (!order.orderDate) {
        context.logger.debug(
          MODULE_NAME,
          `No orderDate on transfer order ${order._id} — skipping.`,
        );
        results.push({ id: order._id, success: true });
        continue;
      }
      await repo.updateTransferOrderTaskDate(order._id, order.orderDate);
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

async function processBackfillPage(
  context: ApplicationContext,
  lastId: string | null,
  pageSize: number,
): Promise<ProcessBackfillPageResult> {
  const pageResult = await getPageNeedingBackfill(context, lastId, pageSize);
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

  const backfillResult = await backfillTaskDates(context, orders);
  if (backfillResult.error) {
    return { status: 'error', error: backfillResult.error as CamsError };
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return {
    status: 'ok',
    processedCount: results.length,
    successCount,
    newLastId,
    failedResults,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

const BackfillTransferOrderTaskDateUseCase = {
  getPageNeedingBackfill,
  backfillTaskDates,
  processBackfillPage,
};

export default BackfillTransferOrderTaskDateUseCase;
