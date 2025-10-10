import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficesController } from './offices.controller';
import { COURT_DIVISIONS } from '../../../../common/src/cams/test-utilities/courts.mock';
import { CamsError } from '../../common-errors/cams-error';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { UnknownError } from '../../common-errors/unknown-error';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

let getOffices = jest.fn();
let getOfficeAttorneys = jest.fn();
let getOfficeAssignees = jest.fn();
const syncOfficeStaff = jest.fn();

jest.mock('../../use-cases/offices/offices', () => {
  return {
    OfficesUseCase: jest.fn().mockImplementation(() => {
      return {
        getOffices,
        getOfficeAttorneys,
        getOfficeAssignees,
        syncOfficeStaff,
      };
    }),
  };
});

describe('offices controller tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return successful when handleTimer is called', async () => {
    const controller = new OfficesController();
    await expect(controller.handleTimer(applicationContext)).resolves.toBeFalsy();
    expect(syncOfficeStaff).toHaveBeenCalled();
  });

  test('should throw error when handleTimer throws', async () => {
    const error = new UnknownError('TEST_MODULE');
    syncOfficeStaff.mockRejectedValue(error);
    const controller = new OfficesController();
    await expect(controller.handleTimer(applicationContext)).rejects.toThrow(error);
    expect(syncOfficeStaff).toHaveBeenCalled();
  });

  test('should return successful response', async () => {
    getOffices = jest.fn().mockResolvedValue(COURT_DIVISIONS);

    const controller = new OfficesController();
    applicationContext.request = mockCamsHttpRequest();
    const offices = await controller.handleRequest(applicationContext);
    expect(offices).toEqual(
      expect.objectContaining({
        body: {
          meta: expect.objectContaining({ self: expect.any(String) }),
          data: COURT_DIVISIONS,
        },
      }),
    );
    expect(getOfficeAttorneys).not.toHaveBeenCalled();
  });

  test('should throw CamsError when one is caught', async () => {
    getOffices = jest
      .fn()
      .mockRejectedValue(
        new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' }),
      );

    const controller = new OfficesController();
    applicationContext.request = mockCamsHttpRequest();
    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Some expected CAMS error.');
    expect(getOfficeAttorneys).not.toHaveBeenCalled();
  });

  test('should wrap unexpected error in UnknownError', async () => {
    getOffices = jest.fn().mockRejectedValue(new Error('Some unknown error.'));

    const controller = new OfficesController();
    await expect(async () => {
      applicationContext.request = mockCamsHttpRequest();
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow('Unknown Error');
    expect(getOfficeAttorneys).not.toHaveBeenCalled();
  });

  test('should call getOfficeAttorneys', async () => {
    getOffices = jest
      .fn()
      .mockRejectedValue(new CamsError('TEST', { message: 'some known error' }));
    getOfficeAttorneys = jest.fn().mockResolvedValue([]);

    const officeCode = 'new-york';
    const subResource = 'attorneys';
    applicationContext.request = mockCamsHttpRequest({ params: { officeCode, subResource } });

    const controller = new OfficesController();
    const attorneys = await controller.handleRequest(applicationContext);
    expect(attorneys).toEqual(
      expect.objectContaining({
        body: { meta: expect.objectContaining({ self: expect.any(String) }), data: [] },
      }),
    );
    expect(getOffices).not.toHaveBeenCalled();
    expect(getOfficeAttorneys).toHaveBeenCalledWith(applicationContext, officeCode);
  });

  test('should call getOfficeAssignees', async () => {
    const assignments = [MockData.getCamsUser()];
    getOffices = jest
      .fn()
      .mockRejectedValue(new CamsError('TEST', { message: 'some known error' }));
    getOfficeAssignees = jest.fn().mockResolvedValue(assignments);

    const officeCode = 'new-york';
    const subResource = 'assignees';
    applicationContext.request = mockCamsHttpRequest({ params: { officeCode, subResource } });

    const controller = new OfficesController();
    const actual = await controller.handleRequest(applicationContext);
    expect(actual).toEqual(
      expect.objectContaining({
        body: { meta: expect.objectContaining({ self: expect.any(String) }), data: assignments },
      }),
    );
    expect(getOffices).not.toHaveBeenCalled();
    expect(getOfficeAssignees).toHaveBeenCalledWith(applicationContext, officeCode);
  });

  test('should call getOffices', async () => {
    getOffices = jest.fn().mockResolvedValue([]);

    applicationContext.request = mockCamsHttpRequest();

    const controller = new OfficesController();
    const attorneys = await controller.handleRequest(applicationContext);
    expect(attorneys).toEqual(
      expect.objectContaining({
        body: { meta: expect.objectContaining({ self: expect.any(String) }), data: [] },
      }),
    );
    expect(getOfficeAttorneys).not.toHaveBeenCalled();
    expect(getOffices).toHaveBeenCalledWith(applicationContext);
  });

  test('should throw error for unsupported subResource', async () => {
    getOffices = jest
      .fn()
      .mockRejectedValue(new CamsError('TEST', { message: 'some known error' }));
    getOfficeAttorneys = jest
      .fn()
      .mockRejectedValue(new CamsError('TEST', { message: 'some known error' }));

    const officeCode = 'new-york';
    const subResource = 'auditors';
    applicationContext.request = mockCamsHttpRequest({ params: { officeCode, subResource } });

    const controller = new OfficesController();
    await expect(async () => {
      await controller.handleRequest(applicationContext);
    }).rejects.toThrow(`Sub resource ${subResource} is not supported.`);
    expect(getOffices).not.toHaveBeenCalled();
    expect(getOfficeAttorneys).not.toHaveBeenCalled();
  });
});
