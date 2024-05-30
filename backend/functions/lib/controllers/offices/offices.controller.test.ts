import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficesController } from './offices.controller';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import { CamsError } from '../../common-errors/cams-error';
import { buildResponseBodySuccess } from '../../../../../common/src/api/response';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import {
  mockCamsHttpRequest,
  mockRequestUrl,
} from '../../testing/mock-data/cams-http-request-helper';

let getOffices;

jest.mock('../../use-cases/offices/offices', () => {
  return {
    OfficesUseCase: jest.fn().mockImplementation(() => {
      return {
        getOffices,
      };
    }),
  };
});

describe('offices controller tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should return successful response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      return Promise.resolve(OFFICES);
    });

    const expected = buildResponseBodySuccess<OfficeDetails[]>(OFFICES, {
      isPaginated: false,
      self: mockRequestUrl,
    });

    const controller = new OfficesController(applicationContext);
    const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber: '00-00000' } });
    const offices = await controller.getOffices(camsHttpRequest);
    expect(offices).toEqual(expected);
  });

  test('should throw CamsError when one is caught', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' });
    });

    const controller = new OfficesController(applicationContext);
    await expect(async () => {
      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber: '00-00000' } });

      await controller.getOffices(camsHttpRequest);
    }).rejects.toThrow('Some expected CAMS error.');
  });

  test('should wrap unexpected error in UnknownError', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new Error('Some unknown error.');
    });

    const controller = new OfficesController(applicationContext);
    await expect(async () => {
      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber: '00-00000' } });

      await controller.getOffices(camsHttpRequest);
    }).rejects.toThrow('Unknown error');
  });
});
