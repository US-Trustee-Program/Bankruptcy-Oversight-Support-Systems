import { HttpRequest, InvocationContext } from '@azure/functions';
import handler from './trustees.function';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteesController } from '../../../lib/controllers/trustees/trustees.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';
import { Trustee } from '../../../../common/src/cams/parties';

// Mock dependencies
jest.mock('../../azure/application-context-creator');
jest.mock('../../../lib/controllers/trustees/trustees.controller');
jest.mock('../../azure/functions');

describe('Trustees Function', () => {
  let mockRequest: HttpRequest;
  let mockInvocationContext: InvocationContext;
  let mockContext: ApplicationContext;
  let mockController: jest.Mocked<TrusteesController>;
  let mockLogger: Partial<LoggerImpl>;

  beforeEach(() => {
    mockRequest = {} as HttpRequest;
    mockInvocationContext = {} as InvocationContext;
    mockContext = {} as ApplicationContext;
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    mockController = {
      handleRequest: jest.fn(),
    } as unknown as jest.Mocked<TrusteesController>;

    (ContextCreator.getLogger as jest.Mock).mockReturnValue(mockLogger);
    (ContextCreator.applicationContextCreator as jest.Mock).mockResolvedValue(mockContext);
    (ContextCreator.getApplicationContextSession as jest.Mock).mockResolvedValue({});
    (TrusteesController as jest.MockedClass<typeof TrusteesController>).mockImplementation(
      () => mockController,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle successful trustee request', async () => {
    const mockResponse: Partial<CamsHttpResponseInit<Trustee>> = {
      statusCode: 200,
      body: { data: [] as unknown as Trustee },
    };
    const mockAzureResponse = { status: 200 };

    mockController.handleRequest.mockResolvedValue(mockResponse);
    (toAzureSuccess as jest.Mock).mockReturnValue(mockAzureResponse);

    const result = await handler(mockRequest, mockInvocationContext);

    expect(ContextCreator.applicationContextCreator).toHaveBeenCalledWith({
      invocationContext: mockInvocationContext,
      logger: mockLogger,
      request: mockRequest,
    });
    expect(ContextCreator.getApplicationContextSession).toHaveBeenCalledWith(mockContext);
    expect(TrusteesController).toHaveBeenCalledWith(mockContext);
    expect(mockController.handleRequest).toHaveBeenCalledWith(mockContext);
    expect(toAzureSuccess).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockAzureResponse);
  });

  test('should handle errors and return azure error response', async () => {
    const error = new Error('Test error');
    const mockAzureError = { status: 500 };

    mockController.handleRequest.mockRejectedValue(error);
    (toAzureError as jest.Mock).mockReturnValue(mockAzureError);

    const result = await handler(mockRequest, mockInvocationContext);

    expect(toAzureError).toHaveBeenCalledWith(mockLogger, 'TRUSTEES-FUNCTION', error);
    expect(result).toEqual(mockAzureError);
  });

  test('should handle context creation errors', async () => {
    const error = new Error('Context creation failed');
    const mockAzureError = { status: 500 };

    (ContextCreator.applicationContextCreator as jest.Mock).mockRejectedValue(error);
    (toAzureError as jest.Mock).mockReturnValue(mockAzureError);

    const result = await handler(mockRequest, mockInvocationContext);

    expect(toAzureError).toHaveBeenCalledWith(mockLogger, 'TRUSTEES-FUNCTION', error);
    expect(result).toEqual(mockAzureError);
  });

  test('should handle session creation errors', async () => {
    const error = new Error('Session creation failed');
    const mockAzureError = { status: 500 };

    (ContextCreator.getApplicationContextSession as jest.Mock).mockRejectedValue(error);
    (toAzureError as jest.Mock).mockReturnValue(mockAzureError);

    const result = await handler(mockRequest, mockInvocationContext);

    expect(toAzureError).toHaveBeenCalledWith(mockLogger, 'TRUSTEES-FUNCTION', error);
    expect(result).toEqual(mockAzureError);
  });
});
