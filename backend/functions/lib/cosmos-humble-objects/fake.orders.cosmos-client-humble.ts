import { ForbiddenError } from '../common-errors/forbidden-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { UnknownError } from '../common-errors/unknown-error';
import { Order } from '../use-cases/orders/orders.model';
import { NotFoundError } from '../common-errors/not-found-error';
import {
  NOT_FOUND_ERROR_CASE_ID,
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../testing/testing-constants';

const MODULE_NAME = 'COSMOS_DB_REPOSITORY_ORDERS';
interface QueryParams {
  name: string;
  value: string;
}

interface QueryOptions {
  query: string;
  parameters: QueryParams[];
}

export default class FakeOrdersCosmosClientHumble {
  private orders: Order[] = [];
  private itemQueryParams: QueryParams[] = [];

  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            create: (orderArray: Order[]) => {
              if (orderArray[0].caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
              }
              if (orderArray[0].caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                throw new UnknownError(MODULE_NAME, { message: 'unknown' });
              }
              orderArray.forEach((order) => {
                this.orders.push(order);
              });
            },
            query: (query: QueryOptions) => {
              this.itemQueryParams = query.parameters;
              return {
                fetchAll: () => {
                  if (this.itemQueryParams[0].value === THROW_PERMISSIONS_ERROR_CASE_ID) {
                    throw new AggregateAuthenticationError([], 'forbidden');
                  } else if (this.itemQueryParams[0].value === NOT_FOUND_ERROR_CASE_ID) {
                    throw new NotFoundError(MODULE_NAME, {
                      data: { ERROR_CASE_ID: NOT_FOUND_ERROR_CASE_ID },
                    });
                  }
                  if (query.query.includes('"ORDERS_SYNC_STATE"')) {
                    // return data in sync format
                    return {
                      id:
                        'orders-sync-id-' + Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000,
                      txId: this.orders.length + 1,
                      documentType: 'ORDERS_SYNC_STATE',
                    };
                  } else {
                    return this.orders;
                  }
                },
              };
            },
          },
          item: (id: string) => {
            return {
              replace: (order: Order) => {
                if (order.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                  throw new ForbiddenError(MODULE_NAME, { message: 'forbidden' });
                }
                if (order.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                  throw new UnknownError(MODULE_NAME);
                }
                console.log(id);
              },
            };
          },
        };
      },
    };
  }
}
