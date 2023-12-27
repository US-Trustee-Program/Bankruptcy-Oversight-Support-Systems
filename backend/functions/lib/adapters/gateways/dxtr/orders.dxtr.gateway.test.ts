import { ApplicationContext } from '../../types/basic';
import * as database from '../../utils/database';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { QueryResults } from '../../types/database';
import { DxtrOrdersGateway } from './orders.dxtr.gateway';

describe('DxtrOrdersGateway', () => {
  describe('getOrders', () => {
    let applicationContext: ApplicationContext;
    const querySpy = jest.spyOn(database, 'executeQuery');

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      querySpy.mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should return a list of orders', async () => {
      const mockOrdersResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockOrdersResults);
      });

      const mockDocumentsResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };

      querySpy.mockImplementationOnce(async () => {
        return Promise.resolve(mockDocumentsResults);
      });

      const gateway = new DxtrOrdersGateway();

      const orders = await gateway.getOrders(applicationContext);
      expect(orders).toEqual([]);
    });
  });
});
