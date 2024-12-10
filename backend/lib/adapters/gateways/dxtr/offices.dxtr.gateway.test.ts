import { CamsError } from '../../../common-errors/cams-error';
import OfficesDxtrGateway from './offices.dxtr.gateway';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import * as database from '../../utils/database';
import { QueryResults } from '../../types/database';
import { COURT_DIVISIONS } from '../../../../../common/src/cams/test-utilities/courts.mock';
import { USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../../../common/src/cams/offices';

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
      applicationContext = await createMockApplicationContext();
      querySpy.mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Should get Offices', async () => {
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset: COURT_DIVISIONS,
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });

      const expectedOffices: UstpOfficeDetails[] = USTP_OFFICES_ARRAY;

      const gateway = new OfficesDxtrGateway();
      const offices = await gateway.getOffices(applicationContext);

      expectedOffices.forEach((expectedOffice) => {
        const actualOffice = offices.find((o) => o.officeCode === expectedOffice.officeCode);
        const { groups: _groups, ...actualRest } = actualOffice;
        const { groups: __groups, ...expectedRest } = expectedOffice;
        expect(actualOffice.groups).toEqual(expect.arrayContaining(expectedOffice.groups));
        expect(actualRest).toEqual(expectedRest);
      });
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
});
