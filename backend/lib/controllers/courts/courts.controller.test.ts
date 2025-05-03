import { COURT_DIVISIONS } from '../../../../common/src/cams/test-utilities/courts.mock';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CourtsController } from './courts.controller';

let getCourts = jest.fn();

jest.mock('../../use-cases/courts/courts', () => {
  return {
    CourtsUseCase: jest.fn().mockImplementation(() => {
      return {
        getCourts,
      };
    }),
  };
});

describe('courts controller tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return successful response', async () => {
    getCourts = jest.fn().mockResolvedValue(COURT_DIVISIONS);

    const controller = new CourtsController();
    const camsHttpRequest = mockCamsHttpRequest();
    applicationContext.request = camsHttpRequest;
    const offices = await controller.handleRequest(applicationContext);
    expect(offices).toEqual(
      expect.objectContaining({
        body: {
          data: COURT_DIVISIONS,
          meta: expect.objectContaining({ self: expect.any(String) }),
        },
      }),
    );
  });

  test('should throw CamsError when one is caught', async () => {
    getCourts = jest
      .fn()
      .mockRejectedValue(
        new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' }),
      );

    const controller = new CourtsController();
    const camsHttpRequest = mockCamsHttpRequest();
    applicationContext.request = camsHttpRequest;
    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Some expected CAMS error.');
  });

  test('should wrap unexpected error in UnknownError', async () => {
    getCourts = jest.fn().mockRejectedValue(new Error('Some unknown error.'));

    const controller = new CourtsController();
    await expect(async () => {
      const camsHttpRequest = mockCamsHttpRequest();
      applicationContext.request = camsHttpRequest;
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');
  });
});
