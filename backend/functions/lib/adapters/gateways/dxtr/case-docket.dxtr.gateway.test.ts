import { Context } from '@azure/functions';
import { ApplicationContext } from '../../types/basic';
import { QueryResults } from '../../types/database';
import { applicationContextCreator } from '../../utils/application-context-creator';
import * as database from '../../utils/database';
import { DxtrCaseDocketGateway } from './case-docket.dxtr.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';

describe('Test case docket DXTR Gateway', () => {
  const querySpy = jest.spyOn(database, 'executeQuery');

  describe('getCaseDocket', () => {
    test('should query the database with the correct predicate values for case id', async () => {
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
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
      const mockCaseId = '111-22-33333';
      await gateway.getCaseDocket(mockContext, mockCaseId);
      expect(querySpy).toHaveBeenCalledWith(
        expect.anything(),
        mockContext.config.dxtrDbConfig,
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ value: '22-33333' }),
          expect.objectContaining({ value: '111' }),
        ]),
      );
    });
    test('should return a docket consisting of an array of docket entries', async () => {
      const recordset = [
        {
          sequenceNumber: 0,
          documentNumber: null,
          dateFiled: '2015-11-05T00:00:00.000Z',
          summaryText: 'Motion for Joint Administration',
          fullText:
            'Clamo bellum repellendus conservo patrocinor commemoro. Coniuratio victus blanditiis ulterius voluptate territo utrimque tam umerus. Repellendus creta cum carpo laudantium adhuc volva provident dolores aqua. Tredecim demens acsi consectetur adfectus compello pecus sed complectus. Conspergo caecus absorbeo.',
        },
        {
          sequenceNumber: 1,
          documentNumber: null,
          dateFiled: '2016-07-12T00:00:00.000Z',
          summaryText: 'Order Re: Motion for Joint Administration',
          fullText:
            'Vorax venio comminor quasi toties eaque soluta. Statua denique asper desino. Voluptatibus inventore cupiditate. Vigilo crastinus contigo aestus credo.',
        },
      ];
      const mockResults: QueryResults = {
        success: true,
        results: {
          recordset,
        },
        message: '',
      };
      querySpy.mockImplementation(async () => {
        return Promise.resolve(mockResults);
      });
      const gateway: DxtrCaseDocketGateway = new DxtrCaseDocketGateway();
      const mockContext: ApplicationContext = await applicationContextCreator(
        {} as unknown as Context,
      );
      const mockCaseId = '111-22-33333';
      const response = await gateway.getCaseDocket(mockContext, mockCaseId);
      expect(response).toEqual(recordset);
    });
  });
});
