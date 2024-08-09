import { CamsError } from '../../../common-errors/cams-error';
import OfficesDxtrGateway from './offices.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import * as database from '../../utils/database';
import { QueryResults } from '../../types/database';
import { MANHATTAN, OFFICES } from '../../../../../../common/src/cams/test-utilities/offices.mock';

describe('offices gateway tests', () => {
  describe('getOffice tests', () => {
    test('should return the name of a known office by ID', () => {
      const gateway = new OfficesDxtrGateway();
      const office = gateway.getOfficeName('011');
      expect(office).toEqual('Boston');
    });

    test('should throw an error for an invalid ID', () => {
      const gateway = new OfficesDxtrGateway();
      const expectedException = new CamsError('OFFICES-GATEWAY', {
        message: 'Cannot find office by ID',
        data: { id: 'AAA' },
      });
      expect(() => {
        gateway.getOfficeName('AAA');
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

    test('Should get Offices', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: OFFICES,
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });

      const gateway = new OfficesDxtrGateway();

      const offices = await gateway.getOffices(applicationContext);
      expect(offices).toEqual(OFFICES);
    });

    test('should throw error when success is false calling getOffices', async () => {
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

  describe('getOfficeByCourtIdAndOfficeCode test', () => {
    let applicationContext: ApplicationContext;
    const querySpy = jest.spyOn(database, 'executeQuery');

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      querySpy.mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Should get office by office code and courtid', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: [MANHATTAN],
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });

      const gateway = new OfficesDxtrGateway();

      const offices = await gateway.getOfficeByCourtIdAndOfficeCode(
        applicationContext,
        '0081',
        '1',
      );
      expect(offices).toEqual(MANHATTAN);
    });

    test('should throw invalid parameter exception with invalid parameters', async () => {
      const gateway = new OfficesDxtrGateway();
      await expect(async () => {
        await gateway.getOfficeByCourtIdAndOfficeCode(applicationContext, '081', '1');
      }).rejects.toThrow('Invalid court id or office code supplied');

      await expect(async () => {
        await gateway.getOfficeByCourtIdAndOfficeCode(applicationContext, '0081', '01');
      }).rejects.toThrow('Invalid court id or office code supplied');
    });

    test('should throw CamsError when success is false when calling getOfficeByCourtIdAndOfficeCode', async () => {
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
        await gateway.getOfficeByCourtIdAndOfficeCode(applicationContext, '0081', '1');
      }).rejects.toThrow('Some expected SQL error.');
    });
  });
});
