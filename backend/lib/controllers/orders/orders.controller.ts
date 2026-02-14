import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { OrdersUseCase, SyncOrdersOptions, SyncOrdersStatus } from '../../use-cases/orders/orders';
import {
  ConsolidationOrder,
  isConsolidationOrderApproval,
  isConsolidationOrderRejection,
  Order,
  TransferOrderAction,
} from '@common/cams/orders';
import { CaseSummary } from '@common/cams/cases';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController, CamsTimerController } from '../controller';
import { NotFoundError } from '../../common-errors/not-found-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'ORDERS-CONTROLLER';

type GetOrdersResponse = CamsHttpResponseInit<Order[]>;
type GetSuggestedCasesResponse = CamsHttpResponseInit<CaseSummary[]>;
type UpdateOrderResponse = CamsHttpResponseInit;
type SyncOrdersResponse = CamsHttpResponseInit<SyncOrdersStatus>;
type ManageConsolidationResponse = CamsHttpResponseInit<ConsolidationOrder[]>;

export class OrdersController implements CamsController, CamsTimerController<SyncOrdersStatus> {
  private readonly useCase: OrdersUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new OrdersUseCase(context);
  }

  public async handleTimer(context: ApplicationContext): Promise<SyncOrdersStatus> {
    try {
      return await this.useCase.syncOrders(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseSummary[] | Order[] | SyncOrdersStatus | undefined>> {
    const simplePath = new URL(context.request.url).pathname.split('/')[2];
    try {
      switch (simplePath) {
        case 'consolidations':
          return await this.handleConsolidations(context);
        case 'orders':
          return await this.handleOrders(context);
        case 'sync-orders':
          return await this.handleOrderSync(context);
        case 'orders-suggestions':
          return await this.handleOrdersSuggestions(context);
        default:
          throw new NotFoundError(MODULE_NAME, {
            message: 'Could not map requested path to action ' + context.request.url,
          });
      }
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private async handleOrders(context: ApplicationContext) {
    let response;
    if (context.request.method === 'GET') {
      response = await this.getOrders(context);
    } else if (context.request.method === 'PATCH') {
      const id = context.request.params['id'];
      response = await this.updateOrder(context, id, context.request.body as TransferOrderAction);
    }
    return response;
  }

  private async handleConsolidations(context: ApplicationContext) {
    const { procedure } = context.request.params;
    let response: ManageConsolidationResponse;

    if (procedure === 'reject') {
      response = await this.rejectConsolidation(context);
    } else if (procedure === 'approve') {
      response = await this.approveConsolidation(context);
    } else {
      throw new BadRequestError(MODULE_NAME, {
        message: `Could not perform ${procedure}.`,
      });
    }
    return response;
  }

  private async handleOrderSync(context: ApplicationContext) {
    return this.syncOrders(context);
  }

  private async handleOrdersSuggestions(context: ApplicationContext) {
    return this.getSuggestedCases(context);
  }

  async getOrders(context: ApplicationContext): Promise<GetOrdersResponse> {
    try {
      const data = await this.useCase.getOrders(context);
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data,
        },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  async getSuggestedCases(context: ApplicationContext): Promise<GetSuggestedCasesResponse> {
    try {
      const data = await this.useCase.getSuggestedCases(context);
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data,
        },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  async updateOrder(
    context: ApplicationContext,
    id: string,
    data: TransferOrderAction,
  ): Promise<UpdateOrderResponse> {
    try {
      const bodyId = data['id'];
      const orderType = data['orderType'];
      if (id !== bodyId) {
        throw new BadRequestError(MODULE_NAME, {
          message: 'Cannot update order. ID of order does not match ID of request.',
        });
      }
      if (orderType === 'transfer') {
        await this.useCase.updateTransferOrder(context, id, data);
      }
      return httpSuccess({
        statusCode: HttpStatusCodes.NO_CONTENT,
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  async syncOrders(context: ApplicationContext): Promise<SyncOrdersResponse> {
    try {
      const options = context.request.body as SyncOrdersOptions;
      const data = await this.useCase.syncOrders(context, options);
      return httpSuccess<SyncOrdersStatus>({
        body: { data },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  async rejectConsolidation(context: ApplicationContext): Promise<ManageConsolidationResponse> {
    try {
      if (isConsolidationOrderRejection(context.request.body)) {
        if (context.request.body.rejectedCases.length == 0) {
          throw new BadRequestError('Missing rejected cases');
        }

        const data = await this.useCase.rejectConsolidation(context, context.request.body);
        return httpSuccess<ConsolidationOrder[]>({
          body: { data },
        });
      }
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  async approveConsolidation(context: ApplicationContext): Promise<ManageConsolidationResponse> {
    try {
      if (isConsolidationOrderApproval(context.request.body)) {
        if (!context.request.body.consolidationType) {
          throw new BadRequestError('Missing consolidation type');
        }

        if (context.request.body.approvedCases.length == 0) {
          throw new BadRequestError('Missing approved cases');
        }

        if (!context.request.body.leadCase) {
          throw new BadRequestError('Missing lead case');
        }

        const data = await this.useCase.approveConsolidation(context, context.request.body);
        return httpSuccess<ConsolidationOrder[]>({
          body: { data },
        });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
