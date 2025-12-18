import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { COURT_DIVISIONS } from '../../../../common/src/cams/test-utilities/courts.mock';
import { CamsError } from '../../common-errors/cams-error';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { CourtsController } from './courts.controller';
import { CourtsUseCase } from '../../use-cases/courts/courts';

describe('courts controller tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return successful response', async () => {
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue(COURT_DIVISIONS);

    const controller = new CourtsController();
    const camsHttpRequest = mockCamsHttpRequest();
    applicationContext.request = camsHttpRequest;
    const offices = await controller.handleRequest(applicationContext);
    expect(offices).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: COURT_DIVISIONS,
        },
      }),
    );
  });

  test('should throw CamsError when one is caught', async () => {
    const camsError = new CamsError('MOCK_OFFICES_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockRejectedValue(camsError);

    const controller = new CourtsController();
    const camsHttpRequest = mockCamsHttpRequest();
    applicationContext.request = camsHttpRequest;
    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Some expected CAMS error.');
  });

  test('should wrap unexpected error in UnknownError', async () => {
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockRejectedValue(
      new Error('Some unknown error.'),
    );

    const controller = new CourtsController();
    await expect(async () => {
      const camsHttpRequest = mockCamsHttpRequest();
      applicationContext.request = camsHttpRequest;
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');
  });
});
