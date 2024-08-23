import { CamsError } from '../lib/common-errors/cams-error';
import { createMockAzureFunctionRequest } from '../azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import { InvocationContext } from '@azure/functions';
import handler from './offices.function';

let getOffices;

jest.mock('../lib/controllers/offices/offices.controller', () => {
  return {
    OfficesController: jest.fn().mockImplementation(() => {
      return {
        getOffices,
      };
    }),
  };
});

describe('offices Function tests', () => {
  const request = createMockAzureFunctionRequest();

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.CaseAssignmentManager],
      },
    }),
  );

  test('should set successful response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: [] });
    });

    const expectedResponseBody = {
      success: true,
      body: [],
    };

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(expectedResponseBody);
  });

  test('should set error response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' });
    });

    const expectedResponseBody = {
      success: false,
      message: 'Some expected CAMS error.',
    };

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(expectedResponseBody);
  });
});
