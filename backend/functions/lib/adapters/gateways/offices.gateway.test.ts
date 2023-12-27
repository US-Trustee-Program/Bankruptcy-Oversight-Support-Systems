import { CamsError } from '../../common-errors/cams-error';
import OfficesDxtrGateway from './offices.gateway';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import * as database from '../utils/database';
import { QueryResults } from '../types/database';

describe('offices gateway tests', () => {
  describe('getOffice tests', () => {
    test('should return the name of a known office by ID', () => {
      const gateway = new OfficesDxtrGateway();
      const office = gateway.getOffice('011');
      expect(office).toEqual('Boston');
    });

    test('should throw an error for an invalid ID', () => {
      const gateway = new OfficesDxtrGateway();
      const expectedException = new CamsError('OFFICES-GATEWAY', {
        message: 'Cannot find office by ID',
        data: { id: 'AAA' },
      });
      expect(() => {
        gateway.getOffice('AAA');
      }).toThrow(expectedException);
    });
  });

  describe('getOffices test', () => {
    let applicationContext: ApplicationContext;
    const querySpy = jest.spyOn(database, 'executeQuery');

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      querySpy.mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: [],
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });

      const gateway = new OfficesDxtrGateway();

      const offices = await gateway.getOffices(applicationContext);
      expect(offices).toEqual([]);
    });

    test('should throw error when success is false', async () => {
      const mockResults: QueryResults = {
        success: false,
        results: {},
        message: 'Some expected SQL error.',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });

      const gateway = new OfficesDxtrGateway();

      await expect(async () => {
        await gateway.getOffices(applicationContext);
      }).rejects.toThrow('Some expected SQL error.');
    });
  });
});
