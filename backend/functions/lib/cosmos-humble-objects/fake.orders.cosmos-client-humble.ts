import { ForbiddenError } from '../common-errors/forbidden-error';
import { UnknownError } from '../common-errors/unknown-error';
import { Order } from '../use-cases/orders/orders.model';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../testing/testing-constants';
import { ORDERS } from '../testing/mock-data/orders.mock';
import { NotFoundError } from '../common-errors/not-found-error';
import { CamsError } from '../common-errors/cams-error';
import { AggregateAuthenticationError } from '@azure/identity';

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
  private orders: Order[] = [...ORDERS];

  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            create: (order: Order) => {
              const existingOrder = this.orders.find((o) => o.caseId === order.caseId);
              if (existingOrder) {
                throw new CamsError(MODULE_NAME, { message: 'unique key violation' });
              }
              if (order.caseId === THROW_PERMISSIONS_ERROR_CASE_ID) {
                throw new AggregateAuthenticationError([
                  new ForbiddenError(MODULE_NAME, { message: 'forbidden' }),
                ]);
              }
              if (order.caseId === THROW_UNKNOWN_ERROR_CASE_ID) {
                throw new UnknownError(MODULE_NAME, { message: 'unknown' });
              }
              this.orders.push(order);
            },
            query: (query: QueryOptions) => {
              return {
                fetchAll: () => {
                  if (query.query.includes('"ORDERS_SYNC_STATE"')) {
                    // return data in sync format
                    return {
                      id:
                        'orders-sync-id-' + Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000,
                      txId: this.orders.length + 1,
                      documentType: 'ORDERS_SYNC_STATE',
                    };
                  } else {
                    return { resources: this.orders };
                  }
                },
              };
            },
          },
          item: (id: string) => {
            return {
              read: () => {
                const order = this.orders.find((order) => order.id === id);
                if (!order) {
                  throw new NotFoundError(MODULE_NAME, {
                    message: `Order not found with id ${id}`,
                  });
                } else {
                  return { item: order };
                }
              },
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

export class FakeOrdersCosmosClientHumbleAuthErrorDuringFetch {
  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            query: (_query: QueryOptions) => {
              return {
                fetchAll: () => {
                  throw new AggregateAuthenticationError([
                    new ForbiddenError(MODULE_NAME, { message: 'forbidden' }),
                  ]);
                },
              };
            },
          },
        };
      },
    };
  }
}

export class FakeOrdersCosmosClientHumbleUnknownErrorDuringFetch {
  public database(_databaseId: string) {
    return {
      container: (_containerName: string) => {
        return {
          items: {
            query: (_query: QueryOptions) => {
              return {
                fetchAll: () => {
                  throw new UnknownError(MODULE_NAME, { message: 'unknown' });
                },
              };
            },
          },
        };
      },
    };
  }
}
