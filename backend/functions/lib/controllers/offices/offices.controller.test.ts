import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficesController } from './offices.controller';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import { CamsError } from '../../common-errors/cams-error';

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

    const expectedResponse = {
      success: true,
      body: OFFICES,
    };

    const controller = new OfficesController();
    const offices = await controller.getOffices(applicationContext);
    expect(offices).toEqual(expectedResponse);
  });

  test('should throw CamsError when one is caught', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' });
    });

    const controller = new OfficesController();
    await expect(async () => {
      await controller.getOffices(applicationContext);
    }).rejects.toThrow('Some expected CAMS error.');
  });

  test('should wrap unexpected error in UnknownError', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new Error('Some unknown error.');
    });

    const controller = new OfficesController();
    await expect(async () => {
      await controller.getOffices(applicationContext);
    }).rejects.toThrow('Unknown error');
  });
});
